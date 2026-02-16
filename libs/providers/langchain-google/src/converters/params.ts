import type {
  ChatGoogleFields,
  GooglePlatformType,
  SimplifiedSpeechConfig,
  SimplifiedSpeechLanguageConfig,
  SpeechSpeakerName,
  SpeechVoice,
  SpeechVoiceLanguage,
} from "../chat_models/types.js";
import type { Gemini } from "../chat_models/api-types.js";

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
 * @returns {Lowercase<Gemini.ThinkingLevel> | undefined}
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
): Gemini.ThinkingLevel | undefined {
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

/**
 * Infers and returns the Google platform type from the provided chat model parameters.
 *
 * This function helps determine which Google platform (e.g., Vertex AI on GCP or the public API)
 * should be used for calling Gemini/PaLM endpoints, based on the options provided in
 * {@link BaseChatGoogleParams} (such as model constructors or call options).
 */
export function convertParamsToPlatformType(params: {
  platformType?: GooglePlatformType;
  vertexai?: boolean;
}): GooglePlatformType | undefined {
  if (typeof params === "undefined") {
    return undefined;
  }
  if (typeof params.platformType !== "undefined") {
    return params.platformType;
  }
  if (params.vertexai === true) {
    return "gcp";
  }
  return undefined;
}

/**
 * Returns the model family from a Gemini model name.
 * e.g. "gemini-2.5-flash" → "gemini"
 */
export function getModelFamily(model: string): string {
  return model.split("-")[0];
}

/**
 * Returns the model version from a Gemini model name.
 * e.g. "gemini-2.5-flash" → "2.5"
 */
export function getModelVersion(model: string): string {
  return model.split("-")[1];
}

/**
 * Returns the model level from a Gemini model name.
 * e.g. "gemini-2.5-flash" → "flash", "gemini-2.5-flash-lite" → "flash-lite"
 */
export function getModelLevel(model: string): string {
  const parts = model.split("-");
  let ret = parts[2];
  if (ret === "flash" && parts[3] === "lite") {
    ret = "flash-lite";
  }
  return ret;
}

/**
 * Returns the model specialty from a Gemini model name.
 * e.g. "gemini-2.5-flash-preview-image" → "image",
 *      "gemini-2.5-flash-preview-tts" → "tts",
 *      "gemini-2.5-flash" → ""
 */
export function getModelSpecialty(model: string): string {
  if (model.includes("image")) {
    return "image";
  } else if (model.includes("tts")) {
    return "tts";
  } else {
    return "";
  }
}

/**
 * Builds the `thinkingConfig` object for the Gemini `generationConfig`,
 * translating user-facing reasoning fields into the wire format.
 *
 * @param model  The full Gemini model name (e.g. "gemini-2.5-flash").
 * @param fields The combined user/call-option fields.
 * @returns A populated {@link Gemini.ThinkingConfig}, or `{}`
 *          when thinking should not be explicitly configured.
 */
export function convertFieldsToThinkingConfig(
  model: string,
  fields: ChatGoogleFields
): Gemini.ThinkingConfig | undefined {
  // Thinking / reasoning
  let includeThoughts = true;

  let thinkingBudget =
    fields?.maxReasoningTokens ??
    fields?.thinkingBudget ??
    convertReasoningEffortToReasoningTokens(
      model,
      fields?.reasoningEffort ?? fields?.thinkingLevel
    );
  if (
    thinkingBudget === 0 ||
    (model.includes("pro") && thinkingBudget === 128)
  ) {
    includeThoughts = false;
  }
  if (
    model.startsWith("gemini-2.5-pro") &&
    typeof thinkingBudget !== "undefined"
  ) {
    // Can't turn off Gemini 2.5 Pro thinking completely
    if (thinkingBudget >= 0 && thinkingBudget < 128) {
      thinkingBudget = 128;
    }
  }

  const thinkingLevelRaw =
    fields?.reasoningEffort ??
    fields?.thinkingLevel ??
    convertReasoningTokensToReasoningEffort(
      model,
      fields?.maxReasoningTokens ?? fields?.thinkingBudget
    );
  let thinkingLevel = thinkingLevelRaw?.toUpperCase();
  if (thinkingLevel === "MINIMAL") {
    includeThoughts = false;
  }
  if (model.startsWith("gemini-3-pro")) {
    // Gemini 3 Pro has only low and high.
    if (thinkingLevel === "MINIMAL") {
      thinkingLevel = "LOW";
    } else if (thinkingLevel === "MEDIUM") {
      thinkingLevel = "HIGH";
    }
  }

  // If we are using a model that doesn't support thinking at all (gemini 2.5 imaging)
  // or we haven't explicitly tried to set a thinking budget/level, then bail out.
  const modelVersion = getModelVersion(model);
  const modelSpecialty = getModelSpecialty(model);
  const thoughtsNotSupported =
    modelVersion === "2.5" && modelSpecialty === "image";
  if (
    thoughtsNotSupported ||
    typeof thinkingBudget === "undefined" ||
    typeof thinkingLevel === "undefined"
  ) {
    return undefined;
  }

  // If we have gotten this far, then we want to explicitly set if we include thoughts or not.
  const thinkingConfig: Gemini.ThinkingConfig = {
    includeThoughts,
  };

  // Explicitly setting the budget/level is only valid (currently) for text models.
  if (modelSpecialty === "") {
    if (model.startsWith("gemini-2.5")) {
      thinkingConfig.thinkingBudget = thinkingBudget;
    } else {
      thinkingConfig.thinkingLevel = thinkingLevel as Gemini.ThinkingLevel;
    }
  }

  return thinkingConfig;
}

/**
 * Builds the `speechConfig` object for the Gemini `generationConfig`,
 * normalising the user-friendly simplified forms into the wire format.
 *
 * @param fields The combined user/call-option fields.
 * @returns A populated {@link Gemini.SpeechConfig}, or `{}`
 *          when no speech config was provided.
 */
export function convertFieldsToSpeechConfig(
  fields: ChatGoogleFields
): Gemini.SpeechConfig | undefined {
  const config: Gemini.SpeechConfig | SimplifiedSpeechConfig | undefined =
    fields.speechConfig;
  if (typeof config === "undefined") {
    return undefined;
  }

  function isSpeechConfig(
    config: Gemini.SpeechConfig | SimplifiedSpeechConfig
  ): config is Gemini.SpeechConfig {
    return (
      typeof config === "object" &&
      (Object.hasOwn(config, "voiceConfig") ||
        Object.hasOwn(config, "multiSpeakerVoiceConfig"))
    );
  }

  function hasLanguage(
    config: SimplifiedSpeechConfig
  ): config is SimplifiedSpeechLanguageConfig {
    return typeof config === "object" && Object.hasOwn(config, "languageCode");
  }

  function hasVoice(
    config: SimplifiedSpeechLanguageConfig
  ): config is SpeechVoiceLanguage {
    return Object.hasOwn(config, "voice");
  }

  // If this is already a SpeechConfig, just return it
  if (isSpeechConfig(config)) {
    return config;
  }

  let languageCode: string | undefined;
  let voice: SpeechVoice;
  if (hasLanguage(config)) {
    languageCode = config.languageCode;
    voice = hasVoice(config) ? config.voice : config.voices;
  } else {
    languageCode = undefined;
    voice = config;
  }

  let ret: Gemini.SpeechConfig;

  if (typeof voice === "string") {
    // They just provided the prebuilt voice configuration name. Use it.
    ret = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: voice,
        },
      },
    };
  } else {
    // This is multi-speaker, so we have speaker/name pairs
    // If we have just one (why?), turn it into an array for the moment
    const voices: SpeechSpeakerName[] = Array.isArray(voice) ? voice : [voice];
    // Go through all the speaker/name pairs and turn this into the voice config array
    const speakerVoiceConfigs: Gemini.SpeakerVoiceConfig[] = voices.map(
      (v: SpeechSpeakerName): Gemini.SpeakerVoiceConfig => ({
        speaker: v.speaker,
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: v.name,
          },
        },
      })
    );
    // Create the multi-speaker voice configuration
    ret = {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs,
      },
    };
  }

  if (languageCode) {
    ret.languageCode = languageCode;
  }

  return ret;
}
