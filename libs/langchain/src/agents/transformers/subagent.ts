import {
  StreamChannel,
  createMessagesTransformer,
  type NativeStreamTransformer,
  type ProtocolEvent,
  type Namespace,
  type LifecycleCause,
} from "@langchain/langgraph";

import { createToolCallTransformer } from "./tool-call.js";
import type { SubagentRunStream } from "./types.js";

interface SubagentProjection {
  subagents: AsyncIterable<SubagentRunStream>;
}

/** Per-subagent transformer instances, driven manually by the parent. */
type MessagesTransformer = ReturnType<typeof createMessagesTransformer>;
type ToolCallTransformer = ReturnType<
  ReturnType<typeof createToolCallTransformer>
>;
type NestedSubagentTransformer = ReturnType<
  ReturnType<typeof createSubagentTransformer>
>;

interface SubagentHandle {
  readonly key: string;
  readonly path: Namespace;
  readonly name: string;
  readonly messages: MessagesTransformer;
  readonly toolCall: ToolCallTransformer;
  readonly nested: NestedSubagentTransformer;
  readonly resolveOutput: (value: unknown) => void;
  readonly rejectOutput: (error: unknown) => void;
  latestValues: Record<string, unknown> | undefined;
  done: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Stable string key for a namespace. */
function nsKey(ns: Namespace): string {
  return ns.join("\u0000");
}

/** Tests whether `ns` starts with every segment in `prefix`. */
function hasPrefix(ns: Namespace, prefix: Namespace): boolean {
  if (prefix.length > ns.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (ns[i] !== prefix[i]) return false;
  }
  return true;
}

/**
 * Creates a native transformer that surfaces nested named agents on
 * `run.subagents`.
 *
 * It watches `tasks` events to record each namespace's `lc_agent_name` (set by
 * `createAgent({ name })`) and the triggering tool call, then — for any nested
 * run one level below {@link scope} that carries an `lc_agent_name` — emits a
 * typed {@link SubagentRunStream} handle.
 *
 * Each handle is backed by its own per-subagent transformer instances
 * ({@link createMessagesTransformer}, {@link createToolCallTransformer}, and a
 * nested {@link createSubagentTransformer}) scoped to the subagent's namespace.
 * Every event in the subtree is fed straight into those transformers, which
 * self-filter by namespace; the subagent's final `output` is resolved from its
 * last `values` snapshot when its `lifecycle` completes.
 *
 * Marked `__native: true` — the `subagents` projection lands directly on the
 * `GraphRunStream` instance as `run.subagents`.
 *
 * @param scope - Namespace prefix this transformer is scoped to. The root agent
 *   uses `[]`; nested handles use their subagent's namespace, so grandchild
 *   subagents are discovered recursively.
 */
export function createSubagentTransformer(
  scope: Namespace = []
): () => NativeStreamTransformer<SubagentProjection> {
  return () => {
    const subagentsLog = StreamChannel.local<SubagentRunStream>();
    /** `lc_agent_name` observed per namespace (first task event wins). */
    const lcByNs = new Map<string, string | undefined>();
    /** Triggering task id -> originating LLM `tool_call_id`. */
    const pendingToolCalls = new Map<string, string>();
    /**
     * Namespace key -> the `tool_call_id` of the most recent tool to start
     * executing there. A tool that invokes a subagent emits its `tool-started`
     * at the tools-node namespace (`tools:<task_id>`) where the subagent then
     * roots, so this is the tool call that caused the subagent.
     */
    const activeToolCallByNs = new Map<string, string>();
    const handles = new Map<string, SubagentHandle>();
    const depth = scope.length;

    function recordIdentity(ns: Namespace, data: unknown): void {
      const key = nsKey(ns);
      if (lcByNs.has(key)) return;
      const metadata =
        isRecord(data) && isRecord(data.metadata) ? data.metadata : undefined;
      const lc = metadata?.lc_agent_name;
      lcByNs.set(key, typeof lc === "string" ? lc : undefined);
    }

    function recordPendingToolCalls(data: unknown): void {
      if (!isRecord(data)) return;
      const taskId = data.id;
      if (typeof taskId !== "string") return;
      const input = data.input;
      let toolCallId: string | undefined;
      if (isRecord(input) && isRecord(input.tool_call)) {
        const candidate = input.tool_call.id;
        if (typeof candidate === "string") toolCallId = candidate;
      } else if (Array.isArray(input)) {
        for (const toolCall of input) {
          if (isRecord(toolCall) && typeof toolCall.id === "string") {
            toolCallId = toolCall.id;
            break;
          }
        }
      }
      if (toolCallId != null) pendingToolCalls.set(taskId, toolCallId);
    }

    /**
     * Derive the `toolCall` cause for a named-subagent namespace.
     *
     * Primary signal: the tool whose `tool-started` event fired at the
     * subagent's own namespace (the tools node it roots under). Fallback: the
     * namespace segment's task id (`node:<task_id>`) joined to a tool call
     * harvested from a `tool_call_with_context`-shaped task input, so the
     * derivation stays correct if that shape reaches the stream in the future.
     */
    function deriveCause(ns: Namespace): LifecycleCause | undefined {
      const active = activeToolCallByNs.get(nsKey(ns));
      if (typeof active === "string" && active.length > 0) {
        return { type: "toolCall", tool_call_id: active } as LifecycleCause;
      }
      const segment = ns[ns.length - 1];
      const colon = segment.indexOf(":");
      if (colon === -1) return undefined;
      const triggerCallId = segment.slice(colon + 1);
      if (triggerCallId.length === 0) return undefined;
      const toolCallId = pendingToolCalls.get(triggerCallId);
      if (typeof toolCallId !== "string" || toolCallId.length === 0) {
        return undefined;
      }
      return { type: "toolCall", tool_call_id: toolCallId } as LifecycleCause;
    }

    function maybeStartSubagent(ns: Namespace): void {
      if (ns.length !== depth + 1 || !hasPrefix(ns, scope)) return;
      const key = nsKey(ns);
      if (handles.has(key)) return;
      const lc = lcByNs.get(key);
      // Only surface nested runs carrying an `lc_agent_name`; plain subgraphs
      // (no name) are excluded so `run.subagents` stays agent-only.
      if (typeof lc !== "string" || lc.length === 0) return;

      // Per-subagent transformers, each scoped to the subagent's namespace so
      // they pick out only the subagent's own model node / tools / nested
      // agents when fed the full event stream.
      const messages = createMessagesTransformer(ns);
      const messagesProjection = messages.init();
      const toolCall = createToolCallTransformer(ns)();
      const toolCallProjection = toolCall.init();
      const nested = createSubagentTransformer(ns)();
      const nestedProjection = nested.init();

      let resolveOutput!: (value: unknown) => void;
      let rejectOutput!: (error: unknown) => void;
      const output = new Promise<Record<string, unknown>>((resolve, reject) => {
        resolveOutput = resolve as (value: unknown) => void;
        rejectOutput = reject;
      });

      handles.set(key, {
        key,
        path: ns,
        name: lc,
        messages,
        toolCall,
        nested,
        resolveOutput,
        rejectOutput,
        latestValues: undefined,
        done: false,
      });

      subagentsLog.push({
        name: lc,
        cause: deriveCause(ns),
        output,
        // `createMessagesTransformer` yields core `ChatModelStream` handles;
        // bridge to the package's richer awaitable `ChatModelStream` type, the
        // same surface `run.messages` exposes.
        messages:
          messagesProjection.messages as unknown as SubagentRunStream["messages"],
        toolCalls:
          toolCallProjection.toolCalls as SubagentRunStream["toolCalls"],
        subagents: nestedProjection.subagents,
      });
    }

    function finishHandle(
      handle: SubagentHandle,
      outcome: { type: "resolve" } | { type: "reject"; error: unknown }
    ): void {
      if (handle.done) return;
      handle.done = true;
      if (outcome.type === "resolve") {
        handle.resolveOutput(handle.latestValues);
      } else {
        handle.rejectOutput(outcome.error);
      }
      handle.messages.finalize?.();
      handle.toolCall.finalize?.();
      handle.nested.finalize?.();
    }

    return {
      __native: true as const,

      init: () => ({ subagents: subagentsLog }),

      process(event: ProtocolEvent): boolean {
        const ns = event.params.namespace;
        const data = event.params.data;
        const isTaskResult =
          event.method === "tasks" && isRecord(data) && "result" in data;

        // Track the tool currently executing at each namespace. A subagent's
        // dispatching tool starts at the same namespace the subagent roots
        // under, so this records the cause before the subagent is discovered.
        if (
          event.method === "tools" &&
          isRecord(data) &&
          data.event === "tool-started" &&
          typeof data.tool_call_id === "string" &&
          data.tool_call_id.length > 0
        ) {
          activeToolCallByNs.set(nsKey(ns), data.tool_call_id);
        }

        // A task start: record identity / tool call, then discover a subagent
        // boundary *before* fanning out so the new handle receives its own
        // subtree events (which Pregel emits after the parent-namespace task).
        if (event.method === "tasks" && !isTaskResult) {
          recordIdentity(ns, data);
          recordPendingToolCalls(data);
          maybeStartSubagent(ns);
        }

        // Fan the event out to every active subagent whose subtree contains it.
        // The per-subagent transformers self-filter by namespace depth.
        for (const handle of handles.values()) {
          if (handle.done) continue;
          if (!hasPrefix(ns, handle.path)) continue;

          handle.messages.process(event);
          handle.toolCall.process(event);
          handle.nested.process(event);

          // Track the subagent's own (root-level) state and resolve its
          // `output` from the last snapshot when its lifecycle completes.
          if (nsKey(ns) === handle.key) {
            if (event.method === "values" && isRecord(data)) {
              handle.latestValues = data;
            } else if (event.method === "lifecycle" && isRecord(data)) {
              const status = data.event;
              if (status === "completed" || status === "interrupted") {
                finishHandle(handle, { type: "resolve" });
              } else if (status === "failed") {
                finishHandle(handle, {
                  type: "reject",
                  error: new Error(`Subagent ${handle.name} failed`),
                });
              }
            }
          }
        }

        return true;
      },

      finalize(): void {
        for (const handle of handles.values()) {
          finishHandle(handle, { type: "resolve" });
        }
        subagentsLog.close();
      },

      fail(err: unknown): void {
        for (const handle of handles.values()) {
          finishHandle(handle, { type: "reject", error: err });
        }
        subagentsLog.fail(err);
      },
    };
  };
}
