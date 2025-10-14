/**
 * jump targets (user facing)
 * @internal
 */
export const JUMP_TO_TARGETS = ["model", "tools", "end"] as const;
/**
 * @internal
 */
export type JumpToTarget = (typeof JUMP_TO_TARGETS)[number];
