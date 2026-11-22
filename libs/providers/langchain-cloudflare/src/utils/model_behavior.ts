/** Provider policies aligned with langchain-cloudflare Python 0.4.3.
 * Keep wire-format differences here; parsing and validation belong to core.
 */
export function getModelBehavior(model: string) {
  const name = model.toLowerCase();
  const routed = name.startsWith("dynamic/") || name === "cloudflare/auto";
  const matches = (family: string) => !routed && name.includes(family);
  return {
    embedToolCalls: matches("llama"),
    structuredJson: ["gemma", "gpt-oss", "mistral"].some(matches),
    nativeJsonSchema: matches("gpt-oss"),
    guidedJson: matches("mistral"),
    reasoning: [
      "glm",
      "gemma",
      "gpt-oss",
      "deepseek",
      "kimi",
      "nemotron",
      "qwen",
    ].some(matches),
    unsupportedParams: matches("mistral")
      ? ["tool_choice"]
      : matches("glm") && !matches("glm-5.3-flash") && !matches("glm-5.2")
        ? ["max_tokens", "repetition_penalty"]
        : [],
  };
}

export function translateModelParams(
  model: string,
  input: Record<string, unknown>
) {
  const params = { ...input };
  const behavior = getModelBehavior(model);
  for (const key of behavior.unsupportedParams) delete params[key];
  const format = params.response_format as
    | { type: string; json_schema?: Record<string, unknown> }
    | undefined;
  if (format) {
    const schema = format.json_schema;
    const raw =
      schema && "schema" in schema && "name" in schema ? schema.schema : schema;
    if (behavior.guidedJson) {
      delete params.response_format;
      params.guided_json = format.type === "json_schema" ? raw : {};
    } else if (format.type === "json_schema") {
      params.response_format = { type: "json_schema", json_schema: raw };
    }
  }
  return params;
}
