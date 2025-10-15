/**
 * jump targets (user facing)
 */
export const JUMP_TO_TARGETS = ["model", "tools", "end"] as const;
export type JumpToTarget = (typeof JUMP_TO_TARGETS)[number];

export const PROMPT_RUNNABLE_NAME = "prompt";
