import type { TracePolicy } from "@langchain/langgraph";

let defaultTracePolicy: TracePolicy | null = null;

/**
 * Configures the process-wide default trace policy for middleware hook spans.
 * Middleware with an explicit `tracePolicy`, including `{}`, overrides it.
 *
 * Call this once during application startup; it applies to every middleware
 * without an explicit policy.
 *
 * @example
 * ```ts
 * import { configureTracePolicy, omitPayload } from "langchain";
 *
 * configureTracePolicy({ processInputs: omitPayload });
 * ```
 */
export function configureTracePolicy(policy: TracePolicy | null): void {
  defaultTracePolicy = policy;
}

export function resolveTracePolicy(
  middlewarePolicy: TracePolicy | undefined
): TracePolicy {
  const resolve = (): TracePolicy | null =>
    middlewarePolicy ?? defaultTracePolicy;
  return {
    processInputs: (value) => {
      const processor = resolve()?.processInputs;
      return processor === undefined ? value : processor(value);
    },
    processOutputs: (value) => {
      const processor = resolve()?.processOutputs;
      return processor === undefined ? value : processor(value);
    },
  };
}
