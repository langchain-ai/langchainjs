import {
  BaseChatGoogleParams,
  ChatGoogleFields,
  GooglePlatformType,
  settableServiceTier,
  SimplifiedSpeechConfig,
  SimplifiedSpeechLanguageConfig,
  SpeechSpeakerName,
  SpeechVoice,
  SpeechVoiceLanguage,
  type Gemini,
} from "../../chat_models/types.js";

import {
  convertReasoningEffortToReasoningTokens,
  convertReasoningTokensToReasoningEffort,
  getModelVersion,
  getModelSpecialty,
} from "../shared/params.js";


// Gemini 3 models that accept thinkingLevel "MINIMAL"; the others reject it with a 400, so they get "LOW".
// TODO: Move this to model profile.
const MINIMAL_THINKING_LEVEL_MODELS = [
  "gemini-3-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
];

function supportsMinimalThinkingLevel(model: string): boolean {
  return MINIMAL_THINKING_LEVEL_MODELS.some((prefix) =>
    model.startsWith(prefix)
  );
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
  if (
    thinkingLevel === "MINIMAL" &&
    model.startsWith("gemini-3") &&
    !supportsMinimalThinkingLevel(model)
  ) {
    thinkingLevel = "LOW";
  }
  if (model.startsWith("gemini-3-pro") && thinkingLevel === "MEDIUM") {
    // Gemini 3 Pro has only low and high.
    thinkingLevel = "HIGH";
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

type ServiceTierResponse = {} | { serviceTier: Gemini.ServiceTier };

/**
 * Builds an object that can be included as part of the request
 * which will add a `speechConfig` attribute if appropriate.
 */
export function convertFieldsToServiceTier(
  platform: GooglePlatformType,
  fields: ChatGoogleFields
): ServiceTierResponse {
  // Service tier is handled in a different way on GCP
  if (platform === "gcp") {
    return {};
  }

  const serviceTier = fields.serviceTier;
  if (!serviceTier || !settableServiceTier.includes(serviceTier)) {
    return {};
  }

  return {
    serviceTier: serviceTier,
  };
}

export function mapDetailToMediaResolution(
  detail?: ChatGoogleFields["detail"]
): Gemini.Shared.MediaResolution | undefined {
  switch (detail) {
    case "low":
      return "MEDIA_RESOLUTION_LOW";
    case "high":
      return "MEDIA_RESOLUTION_HIGH";
    default:
      return undefined;
  }
}

type CombinableFields = Omit<BaseChatGoogleParams, "model">;

export function combineGoogleChatModelFields(
  a: CombinableFields,
  b: CombinableFields,
  ...rest: CombinableFields[]
): CombinableFields {
  const combined: CombinableFields = {
    temperature: b.temperature ?? a.temperature,
    topP: b.topP ?? a.topP,
    topK: b.topK ?? a.topK,
    maxOutputTokens: b.maxOutputTokens ?? a.maxOutputTokens,
    presencePenalty: b.presencePenalty ?? a.presencePenalty,
    frequencyPenalty: b.frequencyPenalty ?? a.frequencyPenalty,
    stopSequences: b.stopSequences ?? a.stopSequences,
    seed: b.seed ?? a.seed,
    responseLogprobs: b.responseLogprobs ?? a.responseLogprobs,
    logprobs: b.logprobs ?? a.logprobs,
    safetySettings: b.safetySettings ?? a.safetySettings,
    responseSchema: b.responseSchema ?? a.responseSchema,
    tools: b.tools ?? a.tools,
    responseModalities: b.responseModalities ?? a.responseModalities,
    enableEnhancedCivicAnswers:
      b.enableEnhancedCivicAnswers ?? a.enableEnhancedCivicAnswers,
    speechConfig: b.speechConfig ?? a.speechConfig,
    imageConfig: b.imageConfig ?? a.imageConfig,
    mediaResolution: b.mediaResolution ?? a.mediaResolution,
    detail: b.detail ?? a.detail,
    maxReasoningTokens: b.maxReasoningTokens ?? a.maxReasoningTokens,
    thinkingBudget: b.thinkingBudget ?? a.thinkingBudget,
    reasoningEffort: b.reasoningEffort ?? a.reasoningEffort,
    thinkingLevel: b.thinkingLevel ?? a.thinkingLevel,
    serviceTier: b.serviceTier ?? a.serviceTier,
  };
  if (rest.length > 0) {
    return combineGoogleChatModelFields(combined, rest[0], ...rest.slice(1));
  }
  return combined;
}

