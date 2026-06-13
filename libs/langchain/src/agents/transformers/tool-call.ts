import {
  StreamChannel,
  type NativeStreamTransformer,
  type ProtocolEvent,
  type ToolCallStream,
  type ToolCallStatus,
  type ToolsEventData,
  type Namespace,
} from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";

interface ToolCallProjection {
  toolCalls: AsyncIterable<ToolCallStream>;
}

/**
 * Returns true when `ns` belongs to the agent's own graph — i.e. it
 * starts with `path` and is at most one level deeper (the agent's
 * internal nodes like `tools`, `model_request`, etc.).
 *
 * Events from subagent subgraphs (two or more levels deeper) are
 * excluded, so `run.toolCalls` / `run.middleware` only show events
 * from the agent itself, not from its subagents.
 */
function isOwnEvent(ns: Namespace, path: Namespace): boolean {
  if (ns.length < path.length || ns.length > path.length + 1) return false;
  for (let i = 0; i < path.length; i += 1) {
    if (ns[i] !== path[i]) return false;
  }
  return true;
}

function isHeadlessToolInterruptError(
  message: string,
  toolCallId: string | undefined
): boolean {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (!Array.isArray(parsed)) return false;
    return parsed.some((entry) => {
      if (entry == null || typeof entry !== "object") return false;
      const value = (entry as { value?: unknown }).value;
      if (value == null || typeof value !== "object") return false;
      const payload = value as {
        type?: unknown;
        toolCall?: { id?: unknown };
      };
      return (
        payload.type === "tool" &&
        (toolCallId == null ||
          payload.toolCall?.id == null ||
          payload.toolCall.id === toolCallId)
      );
    });
  } catch {
    return false;
  }
}

/**
 * Detects serialized LangChain `ToolMessage` values that can appear on
 * `tool-finished.output` after crossing a protocol or serialization boundary.
 *
 * @example
 * ```ts
 * {
 *   lc: 1,
 *   type: "constructor",
 *   id: ["langchain_core", "messages", "ToolMessage"],
 *   kwargs: { content: "raw tool result", tool_call_id: "call_1" }
 * }
 * ```
 */
function isSerializedToolMessage(
  value: unknown
): value is { kwargs?: { content?: unknown } } {
  if (value == null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.type !== "constructor" || !Array.isArray(record.id)) return false;
  return record.id[record.id.length - 1] === "ToolMessage";
}

function normalizeToolOutput(output: unknown): unknown {
  if (ToolMessage.isInstance(output)) {
    return output.content;
  }
  if (isSerializedToolMessage(output)) {
    return output.kwargs?.content;
  }
  return output;
}

/**
 * Creates a native transformer that correlates `tools` channel events
 * into per-call {@link ToolCallStream} objects.
 *
 * Marked `__native: true` — projection keys land directly on the
 * `GraphRunStream` instance as `run.toolCalls`.
 */
export function createToolCallTransformer(
  path: Namespace
): () => NativeStreamTransformer<ToolCallProjection> {
  return () => {
    const toolCallsLog = StreamChannel.local<ToolCallStream>();

    const pendingCalls = new Map<
      string,
      {
        resolveOutput: (v: unknown) => void;
        rejectOutput: (e: unknown) => void;
        resolveStatus: (v: ToolCallStatus) => void;
        resolveError: (v: string | undefined) => void;
      }
    >();

    function createToolCallEntry(
      callId: string,
      name: string,
      rawInput: unknown
    ): void {
      if (pendingCalls.has(callId)) return;
      const input =
        typeof rawInput === "string" ? JSON.parse(rawInput) : rawInput;

      let resolveOutput!: (v: unknown) => void;
      let rejectOutput!: (e: unknown) => void;
      let resolveStatus!: (v: ToolCallStatus) => void;
      let resolveError!: (v: string | undefined) => void;

      const output = new Promise<unknown>((res, rej) => {
        resolveOutput = res;
        rejectOutput = rej;
      });
      const status = new Promise<ToolCallStatus>((res) => {
        resolveStatus = res;
      });
      const error = new Promise<string | undefined>((res) => {
        resolveError = res;
      });

      pendingCalls.set(callId, {
        resolveOutput,
        rejectOutput,
        resolveStatus,
        resolveError,
      });

      toolCallsLog.push({
        name,
        callId,
        input,
        output,
        status,
        error,
      } as ToolCallStream);
    }

    return {
      __native: true as const,

      init: () => ({
        toolCalls: toolCallsLog,
      }),

      process(event: ProtocolEvent): boolean {
        /**
         * Only process events that are at the same depth as the agent's graph.
         */
        if (!isOwnEvent(event.params.namespace, path)) return true;

        if (event.method === "messages") {
          const data = event.params.data as Record<string, unknown>;
          if (data.event === "content-block-finish") {
            const cb = (data.contentBlock ?? data.content_block) as
              | Record<string, unknown>
              | undefined;
            if (cb?.type === "tool_call") {
              createToolCallEntry(
                String(cb.id ?? ""),
                String(cb.name ?? ""),
                cb.args ?? cb.input
              );
            }
          }
        }

        if (event.method === "tools") {
          const data = event.params.data as ToolsEventData;
          const toolCallId = (data as Record<string, unknown>)
            .tool_call_id as string;

          if (data.event === "tool-started") {
            createToolCallEntry(
              toolCallId,
              ((data as Record<string, unknown>).tool_name as string) ??
                "unknown",
              (data as Record<string, unknown>).input
            );
          }

          const pending = toolCallId ? pendingCalls.get(toolCallId) : undefined;

          if (pending) {
            if (data.event === "tool-finished") {
              pending.resolveOutput(
                normalizeToolOutput((data as Record<string, unknown>).output)
              );
              pending.resolveStatus("finished");
              pending.resolveError(undefined);
              pendingCalls.delete(toolCallId);
            } else if (data.event === "tool-error") {
              const message =
                ((data as Record<string, unknown>).message as string) ??
                "unknown error";
              if (isHeadlessToolInterruptError(message, toolCallId)) {
                return true;
              }
              pending.rejectOutput(new Error(message));
              pending.resolveStatus("error");
              pending.resolveError(message);
              pendingCalls.delete(toolCallId);
            }
          }
        }

        return true;
      },

      finalize(): void {
        for (const pending of pendingCalls.values()) {
          pending.resolveStatus("finished");
          pending.resolveError(undefined);
          pending.resolveOutput(undefined);
        }
        pendingCalls.clear();
        toolCallsLog.close();
      },

      fail(err: unknown): void {
        for (const pending of pendingCalls.values()) {
          pending.resolveStatus("error");
          pending.resolveError(
            err instanceof Error ? err.message : String(err)
          );
          pending.rejectOutput(err);
        }
        pendingCalls.clear();
        toolCallsLog.fail(err);
      },
    };
  };
}
