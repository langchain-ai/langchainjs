import type { ToolCallRequest } from "./types.js";

/** @internal Invocation-local metadata; never attached to the thrown value. */
// Share the key across ESM/CJS copies, but keep every context on its request.
export const TOOL_ERROR_CONTEXT = Symbol.for("langchain.toolErrorContext");

/** @internal */
export interface ToolErrorContext {
  fatalErrors: Set<unknown>;
}

/** @internal */
export function getToolErrorContext(
  request: object
): ToolErrorContext | undefined {
  return (request as { [TOOL_ERROR_CONTEXT]?: ToolErrorContext })[
    TOOL_ERROR_CONTEXT
  ];
}

/**
 * Keep an intentional tool-error rethrow fatal by default, without replacing or
 * mutating the thrown value. Use this in `wrapToolCall` immediately before
 * rethrowing an error that must stop the agent instead of becoming a ToolMessage.
 * An explicit `ToolNode` option `handleToolErrors: true` still handles the error.
 * Graph control flow and cancellation always propagate.
 *
 * Pass the request received by the hook, or a spread copy. Requests without an
 * active tool-error context (for example, standalone middleware tests) are a
 * no-op. Marks on a completed invocation cannot affect later invocations.
 * Marks are local to this tool call: a nested agent's ordinary Error follows
 * the parent tool call's error policy, without cross-agent metadata.
 *
 * An explicit mark lasts for this invocation of the hook. For inherited marks,
 * a later sequential handler attempt throwing the same value replaces its
 * previous fatality. Overlapping attempts that throw the same value retain any
 * fatal mark: identical values cannot distinguish individual throw occurrences.
 *
 * @example
 * ```ts
 * wrapToolCall: async (request, handler) => {
 *   try {
 *     return await handler(request);
 *   } catch (error) {
 *     markToolErrorAsFatal(request, error);
 *     throw error;
 *   }
 * }
 * ```
 */
export function markToolErrorAsFatal<
  TState extends Record<string, unknown>,
  TContext,
>(request: ToolCallRequest<TState, TContext>, error: unknown): void {
  getToolErrorContext(request)?.fatalErrors.add(error);
}
