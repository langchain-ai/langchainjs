const SUPPORTED_METHODS = [
  "jsonSchema",
  "functionCalling",
  "jsonMode",
] as const;
type SupportedMethod = (typeof SUPPORTED_METHODS)[number];

/**
 * Get the structured output method for a given model. By default, it uses
 * `jsonSchema` if the model supports it, otherwise it uses `functionCalling`.
 *
 * @throws if the method is invalid, e.g. is not a string or invalid method is provided.
 * @param model - The model name.
 * @param config - The structured output method options.
 * @returns The structured output method.
 */
export function getStructuredOutputMethod(
  model: string,
  method: unknown
): SupportedMethod {
  /**
   * If a method is provided, validate it.
   */
  if (
    typeof method !== "undefined" &&
    !SUPPORTED_METHODS.includes(method as SupportedMethod)
  ) {
    throw new Error(
      `Invalid method: ${method}. Supported methods are: ${SUPPORTED_METHODS.join(
        ", "
      )}`
    );
  }

  const hasSupportForJsonSchema =
    !model.startsWith("gpt-3") &&
    !model.startsWith("gpt-4-") &&
    model !== "gpt-4";

  /**
   * If the model supports JSON Schema, use it by default.
   */
  if (hasSupportForJsonSchema && !method) {
    return "jsonSchema";
  }

  if (!hasSupportForJsonSchema && method === "jsonSchema") {
    throw new Error(
      `JSON Schema is not supported for model "${model}". Please use a different method, e.g. "functionCalling" or "jsonMode".`
    );
  }

  /**
   * If the model does not support JSON Schema, use function calling by default.
   */
  return (method as SupportedMethod) ?? "functionCalling";
}
