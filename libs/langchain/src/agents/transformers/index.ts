/**
 * Agent-level streaming support (experimental).
 *
 * Native stream transformer factories whose projections are assigned directly
 * onto the `GraphRunStream` instance by `createGraphRunStream` in langgraph-core
 * (when marked `__native: true`) — no subclass or wrapper needed:
 *
 * - {@link createToolCallTransformer} → `run.toolCalls`
 * - {@link createSubagentTransformer} → `run.subagents`
 *
 */

export { createToolCallTransformer } from "./tool-call.js";
export { createSubagentTransformer } from "./subagent.js";
export type {
  AgentRunStream,
  ToolCallStreamUnion,
  SubagentRunStream,
  InferStreamExtensions,
} from "./types.js";
