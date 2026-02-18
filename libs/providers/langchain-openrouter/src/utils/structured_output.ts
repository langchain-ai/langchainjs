import type { ModelProfile } from "@langchain/core/language_models/profile";

const SUPPORTED_STRUCTURED_OUTPUT_METHODS = [
  "jsonSchema",
  "functionCalling",
  "jsonMode",
] as const;

export type OpenRouterStructuredOutputMethod =
  (typeof SUPPORTED_STRUCTURED_OUTPUT_METHODS)[number];

interface ResolveStructuredOutputMethodParams {
  model: string;
  method: unknown;
  profile: ModelProfile;
  models?: string[];
  route?: "fallback";
}

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

  // OpenRouter routing may resolve to different backend models at runtime.
  // Use function calling as the safer default when model capability certainty is lower.
  if (hasRoutedModelSelection) {
    return "functionCalling";
  }

  return supportsStructuredOutput ? "jsonSchema" : "functionCalling";
}
