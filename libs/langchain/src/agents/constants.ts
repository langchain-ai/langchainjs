/**
 * jump targets (user facing)
 *
 * - "model": jump back to the model request node for another LLM call
 * - "tools": jump to tool execution (requires tools to be available)
 * - "end": end the run early; afterAgent middleware still runs before the graph terminates
 */
export const JUMP_TO_TARGETS = ["model", "tools", "end"] as const;
export type JumpToTarget = (typeof JUMP_TO_TARGETS)[number];
