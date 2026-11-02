import type { KVMap } from "langsmith/schemas";

/**
 * Transforms what `LangChainTracer` sends to LangSmith for a run. Execution
 * values and every other callback handler (including `streamEvents`) still
 * see the raw inputs and outputs. Processors receive the recorded values by
 * reference and must not mutate them.
 */
export interface TracePolicy {
  processInputs?: (inputs: KVMap) => KVMap;
  processOutputs?: (outputs: KVMap) => KVMap;
}

/**
 * Key a run's `extra` carries its policy under. A symbol, so the policy is
 * never serialized with the run.
 * @internal
 */
export const TRACE_POLICY_KEY = Symbol.for("langchain.trace_policy");
