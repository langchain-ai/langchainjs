import type { ModelProfile } from "@langchain/core/language_models/profile";

/**
 * The three strategies OpenRouter can use to extract structured output:
 *
 * - `"jsonSchema"` — native JSON Schema response format (only models that
 *    advertise `structuredOutput` in their profile support this).
 * - `"functionCalling"` — wraps the schema as a tool/function call and
 *    parses the tool output. Works on any model that supports tools.
 * - `"jsonMode"` — asks the model to respond in JSON without a strict
 *    schema constraint (`response_format: { type: "json_object" }`).
 */
const SUPPORTED_STRUCTURED_OUTPUT_METHODS = [
  "jsonSchema",
  "functionCalling",
  "jsonMode",
] as const;

export type OpenRouterStructuredOutputMethod =
  (typeof SUPPORTED_STRUCTURED_OUTPUT_METHODS)[number];

interface ResolveStructuredOutputMethodParams {
  /** The model identifier, e.g. `"anthropic/claude-4-sonnet"`. */
  model: string;
  /** Caller-requested method, or `undefined` to auto-detect. */
  method: unknown;
  /** Static capability profile for the model. */
  profile: ModelProfile;
  /** Optional list of candidate models used with OpenRouter routing. */
  models?: string[];
  /** Optional routing strategy (currently only `"fallback"`). */
  route?: "fallback";
}

/**
 * Determines which structured-output strategy to use for a given model
 * and caller configuration.
 *
 * Resolution order:
 * 1. If the caller explicitly requested a method, validate and return it
 *    (throws if the method is unsupported or incompatible with the model).
 * 2. If OpenRouter routing is active (multi-model `models` list or
 *    `route: "fallback"`), fall back to `"functionCalling"` because the
 *    actual backend model — and its capabilities — are unknown at request
 *    time.
 * 3. Otherwise, pick the best method the model supports: `"jsonSchema"`
 *    when the profile advertises native structured output, else
 *    `"functionCalling"`.
 */
export function resolveOpenRouterStructuredOutputMethod({
  model,
  method,
  profile,
  models,
  route,
}: ResolveStructuredOutputMethodParams): OpenRouterStructuredOutputMethod {
  if (
    method !== undefined &&
    !SUPPORTED_STRUCTURED_OUTPUT_METHODS.includes(
      method as OpenRouterStructuredOutputMethod
    )
  ) {
    throw new Error(
      `Invalid structured output method: ${String(
        method
      )}. Supported methods are: ${SUPPORTED_STRUCTURED_OUTPUT_METHODS.join(
        ", "
      )}`
    );
  }

  const supportsStructuredOutput = profile.structuredOutput === true;

  if (method === "jsonSchema" && !supportsStructuredOutput) {
    throw new Error(
      `Structured output method "jsonSchema" is not supported for model "${model}". Use "functionCalling" or "jsonMode" instead.`
    );
  }

  if (method !== undefined) {
    return method as OpenRouterStructuredOutputMethod;
  }

  const hasRoutedModelSelection =
    route === "fallback" || (models?.length ?? 0) > 0;

  if (hasRoutedModelSelection) {
    return "functionCalling";
  }

  return supportsStructuredOutput ? "jsonSchema" : "functionCalling";
}
