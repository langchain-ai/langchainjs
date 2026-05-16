/* oxlint-disable @typescript-eslint/no-explicit-any */

/**
 * Agent-level streaming support (experimental).
 *
 * Provides native stream transformer factories for tool calls and
 * middleware events.  When marked `__native: true`, their projections
 * are assigned directly onto the `GraphRunStream` instance by
 * `createGraphRunStream` in langgraph-core — no subclass or wrapper
 * needed.
 *
 * See protocol proposal §15 (In-Process Streaming Interface) and §16
 * (Native Stream Transformers).
 */

import {
  GraphRunStream,
  StreamChannel,
  type NativeStreamTransformer,
  type ProtocolEvent,
  type StreamTransformer,
  type ToolCallStream,
  type ToolCallStatus,
  type ToolsEventData,
  type Namespace,
} from "@langchain/langgraph";
import type {
  ClientTool,
  ServerTool,
  DynamicStructuredTool,
  StructuredToolInterface,
} from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";

/**
 * Infers the merged extensions shape from a tuple of stream transformer
 * factories. Mirrors `InferExtensions` from `@langchain/langgraph`, which
 * is not exported from the package's public surface.
 *
 * Given `[() => StreamTransformer<{ a: number }>, () => StreamTransformer<{ b: string }>]`,
 * produces `{ a: number } & { b: string }`.
 */
export type InferStreamExtensions<
  T extends ReadonlyArray<() => StreamTransformer<any>>,
> = T extends readonly []
  ? Record<string, never>
  : T extends readonly [
        () => StreamTransformer<infer P>,
        ...infer Rest extends ReadonlyArray<() => StreamTransformer<any>>,
      ]
    ? P & InferStreamExtensions<Rest>
    : Record<string, unknown>;

/** Extract the literal `name` string from a tool type. */
type ToolNameOf<T> = T extends { name: infer N extends string } ? N : string;

/** Extract the parsed input type from a tool type. */
type ToolInputOf<T> =
  T extends DynamicStructuredTool<any, any, infer SchemaInputT, any, any, any>
    ? SchemaInputT
    : T extends StructuredToolInterface<any, infer SchemaInputT, any>
      ? SchemaInputT
      : unknown;

/** Extract the return/output type from a tool type. */
type ToolOutputOf<T> =
  T extends DynamicStructuredTool<any, any, any, infer ToolOutputT, any, any>
    ? ToolOutputT
    : T extends StructuredToolInterface<any, any, infer ToolOutputT>
      ? ToolOutputT
      : unknown;

/**
 * Discriminated union of {@link ToolCallStream} variants, one per tool
 * in `TTools`.  Enables TypeScript to narrow `.input` and `.output`
 * when the consumer checks `call.name === "someToolName"`.
 *
 * Falls back to `ToolCallStream` (untyped) when the tools tuple is a
 * plain `(ClientTool | ServerTool)[]` without literal name types.
 */
export type ToolCallStreamUnion<
  TTools extends readonly (ClientTool | ServerTool)[],
> = {
  [K in keyof TTools]: ToolCallStream<
    ToolNameOf<TTools[K]>,
    ToolInputOf<TTools[K]>,
    ToolOutputOf<TTools[K]>
  >;
}[number];

/**
 * A {@link GraphRunStream} with native agent-level projections assigned
 * directly on the instance by `createGraphRunStream` (via `__native`
 * transformers).
 *
 * This is a pure type overlay — no runtime subclass exists.  Use the
 * `AgentRunStream` type when you need to describe the return type of
 * `streamEvents(..., { version: "v3" })`.
 *
 * @typeParam TValues - Shape of the graph's state values.
 * @typeParam TTools - Tuple of tools registered on the agent, used to type
 *   the per-tool `toolCalls` discriminated union.
 * @typeParam TMiddleware - Tuple of middleware registered on the agent, used
 *   to type the per-middleware `middleware` event union.
 * @typeParam TExtensions - Shape of `run.extensions` produced by user-supplied
 *   stream transformer factories. Derived via
 *   `InferExtensions<TStreamTransformers>`.
 */
export type AgentRunStream<
  TValues = Record<string, unknown>,
  TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
  TExtensions extends Record<string, unknown> = Record<string, unknown>,
> = GraphRunStream<TValues, TExtensions> & {
  /** Tool call streams from the native ToolCallTransformer. */
  toolCalls: AsyncIterable<ToolCallStreamUnion<TTools>>;
};

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
