/**
 * Converts a reasoning "effort" level value (e.g., "minimal", "low", "medium", "high")
 * to a corresponding reasoning token budget, depending on the target Gemini model.
 *
 * This mapping is essential when configuring Google Gemini API calls with reasoning
 * effort/level fields (as in the Gemini OpenAI-compatible API) or when translating
 * user-friendly configuration to explicit token budgets.
 *
 * - The mapping is refined to reflect the constraints documented by Google:
 *   - For "gemini-2.5-flash" models, token budgets may be set as low as 0 and up to 24k.
 *   - For other Gemini models, minimum is 128, maximum is 32k.
 * - Standard effort levels and their token mappings:
 *   - "none" / "minimal": lowest allowed (minTokens)
 *   - "low": 1k tokens
 *   - "medium": 8k tokens
 *   - "high": maximum allowed for the model (maxTokens)
 * - See reference:
 *   https://ai.google.dev/gemini-api/docs/thinking#thinking-levels
 *   https://ai.google.dev/gemini-api/docs/openai#thinking
 *
 * @param {string | undefined} modelName
 *   The Gemini model name (e.g., "gemini-2.5-flash"). Used to determine token range constraints.
 * @param {string | undefined} effort
 *   The reasoning effort level: one of "none", "minimal", "low", "medium", "high".
 *   If undefined, the function returns undefined.
 * @returns {number | undefined}
 *   The corresponding token count for the given effort and model. Returns undefined if
 *   the effort is not recognized or not provided.
 *
 * @example
 * convertReasoningEffortToReasoningTokens("gemini-2.5-flash", "medium") // 8192
 * convertReasoningEffortToReasoningTokens("gemini-1.5-pro", "high") // 32768
 * convertReasoningEffortToReasoningTokens("gemini-2.5-flash", "none") // 0
 * convertReasoningEffortToReasoningTokens(undefined, "low") // 1024
 */
export function convertReasoningEffortToReasoningTokens(
  modelName?: string,
  effort?: string
): number | undefined {
  if (effort === undefined) {
    return undefined;
  }

  // gemini-2.5-flash and -flash-lite can be disabled. Others can't.
  // https://ai.google.dev/gemini-api/docs/thinking#thinking-levels
  const minTokens: number = modelName?.startsWith("gemini-2.5-flash") ? 0 : 128;
  const maxTokens: number = modelName?.startsWith("gemini-2.5-flash")
    ? 24 * 1024
    : 32 * 1024;

  switch (effort) {
    case "none":
    case "minimal":
      return minTokens;
    case "low":
      // Defined as 1k by https://ai.google.dev/gemini-api/docs/openai#thinking
      return 1024;
    case "medium":
      // Defined as 8k by https://ai.google.dev/gemini-api/docs/openai#thinking
      return 8 * 1024;
    case "high":
      // Defined as 24k or 32k (model-dependent) by https://ai.google.dev/gemini-api/docs/openai#thinking
      return maxTokens;
    default:
      return undefined;
  }
}

/**
 * Converts a reasoning token budget (e.g., 0, 1024, 8192, 32768) to its corresponding
 * reasoning "effort" level, as used in the Google Gemini API ("minimal", "low", "medium", "high").
 *
 * This is the inverse of {@link convertReasoningEffortToReasoningTokens}. It is useful for
 * translating explicit numeric settings (often surfaced in raw API responses or configs)
 * into user-facing friendly reasoning levels/labels. The mapping relies on Google's
 * documented reasoning levels for different models:
 *
 * - -1 means "high" effort (per API documentation: the default, dynamic setting).
 * - 0 means "minimal" unless the model is "gemini-3-pro", for which it maps to "low".
 * - <= 1024 tokens: "low"
 * - <= 8192 tokens: "medium" (unless model is "gemini-3-pro", for which it reverts to "low")
 * - > 8192: "high"
 *
 * Reference:
 *   https://ai.google.dev/gemini-api/docs/thinking#thinking-levels
 *   https://ai.google.dev/gemini-api/docs/openai#thinking
 *
 * @param {string | undefined} model
 *   The Gemini model name (e.g., "gemini-3-pro"). Used for model-specific special cases.
 * @param {number | undefined} reasoningTokens
 *   The token budget to convert. If undefined, the function returns undefined.
 * @returns {Lowercase<GoogleThinkingLevel> | undefined}
 *   The reasoning "effort" level ("minimal", "low", "medium", "high") or undefined if input is not valid.
 *
 * @example
 * convertReasoningTokensToReasoningEffort("gemini-3-pro", 0) // "low"
 * convertReasoningTokensToReasoningEffort("gemini-1.5-pro", 0) // "minimal"
 * convertReasoningTokensToReasoningEffort(undefined, 1024) // "low"
 * convertReasoningTokensToReasoningEffort(undefined, -1) // "high"
 * convertReasoningTokensToReasoningEffort(undefined, 9000) // "high"
 */
export function convertReasoningTokensToReasoningEffort(
  model?: string,
  reasoningTokens?: number
  // TODO(hntrl): sauce this from generative language api types (requires sparktype enum fix)
): Lowercase<string> | undefined {
  if (typeof reasoningTokens === "undefined") {
    return undefined;
  } else if (reasoningTokens === -1) {
    // -1 means "high"/dynamic ("default" per https://ai.google.dev/gemini-api/docs/thinking#thinking-levels)
    return "high";
  } else if (reasoningTokens === 0) {
    if (model?.startsWith("gemini-3-pro")) {
      return "low";
    } else {
      return "minimal";
    }
  } else if (reasoningTokens <= 1024) {
    return "low";
  } else if (reasoningTokens <= 8192) {
    if (model?.startsWith("gemini-3-pro")) {
      return "low";
    } else {
      return "medium";
    }
  } else {
    return "high";
  }
}
