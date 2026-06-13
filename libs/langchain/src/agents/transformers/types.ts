/* oxlint-disable @typescript-eslint/no-explicit-any */

import type {
  GraphRunStream,
  ChatModelStream,
  StreamTransformer,
  ToolCallStream,
  LifecycleCause,
} from "@langchain/langgraph";
import type {
  ClientTool,
  ServerTool,
  DynamicStructuredTool,
  StructuredToolInterface,
} from "@langchain/core/tools";

/**
 * Infers the merged extensions shape from a tuple of stream transformer
 * factories.
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
 * A nested named-agent execution surfaced on `run.subagents`.
 *
 * A subagent is a nested `createAgent` run whose `lc_agent_name` differs from
 * its parent's — e.g. a `createAgent({ name })` invoked inside a tool body. The
 * handle exposes scoped projections (`messages`, `toolCalls`, nested
 * `subagents`) plus the resolved {@link name}, the {@link cause} that triggered
 * it, and the subagent's final {@link output} state.
 *
 * This is a self-contained handle (no subclass of `SubgraphRunStream`): its
 * projections are produced by per-subagent transformer instances that
 * {@link createSubagentTransformer} drives directly.
 *
 * @typeParam TValues - Shape of the subagent's final output state.
 * @typeParam TTools - Tuple of tools the subagent may call, used to type
 *   {@link toolCalls}.
 */
export interface SubagentRunStream<
  TValues = Record<string, unknown>,
  TTools extends readonly (ClientTool | ServerTool)[] = readonly (
    | ClientTool
    | ServerTool
  )[],
> {
  /** The subagent's `lc_agent_name` (set by `createAgent({ name })`). */
  readonly name: string;

  /**
   * The tool call that dispatched this subagent, as
   * `{ type: "toolCall", tool_call_id }`, or `undefined` when the originating
   * tool call could not be recovered (e.g. it was not triggered from a tool).
   */
  readonly cause: LifecycleCause | undefined;

  /** Resolves with the subagent's final state once it completes. */
  readonly output: Promise<TValues>;

  /** Per-message chat-model token streams scoped to this subagent. */
  readonly messages: AsyncIterable<ChatModelStream>;

  /** The subagent's own tool-call streams. */
  readonly toolCalls: AsyncIterable<ToolCallStreamUnion<TTools>>;

  /** Nested subagents this subagent dispatches from its own tools. */
  readonly subagents: AsyncIterable<SubagentRunStream>;
}

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
 * @typeParam TExtensions - Shape of `run.extensions` produced by user-supplied
 *   stream transformer factories. Derived via
 *   `InferStreamExtensions<TStreamTransformers>`.
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

  /**
   * Named subagent runs dispatched from tools, surfaced by the native
   * {@link createSubagentTransformer}.  Each yielded {@link SubagentRunStream}
   * is a nested `createAgent` run whose `lc_agent_name` differs from this
   * agent's — for example a `createAgent({ name })` invoked inside a tool body.
   * Unlike `run.subgraphs` (which also yields the agent's own internal nodes),
   * `run.subagents` only yields real named-agent invocations.
   */
  subagents: AsyncIterable<SubagentRunStream<TValues>>;
};
