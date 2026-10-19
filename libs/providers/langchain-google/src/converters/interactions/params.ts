import { isInteropZodSchema } from "@langchain/core/utils/types";
import { isSerializableSchema } from "@langchain/core/utils/standard_schema";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import {
  type BaseChatGoogleParams,
  type ChatGoogleFields,
  type GooglePlatformType,
  settableServiceTier,
  type Gemini,
} from "../../chat_models/types.js";
import {
  convertFieldsToSpeechConfig,
  convertFieldsToThinkingConfig,
  mapDetailToMediaResolution,
} from "../generate_content/params.js";
import { convertReasoningTokensToReasoningEffort } from "../shared/params.js";

type CombinableInteractionsFields = Omit<BaseChatGoogleParams, "model">;

/**
 * Merges constructor parameters and per-call options for the Interactions API,
 * giving precedence to `b` over `a` for each field.
 */
export function combineInteractionsFields(
  a: CombinableInteractionsFields,
  b: CombinableInteractionsFields,
  ...rest: CombinableInteractionsFields[]
): CombinableInteractionsFields {
  const combined: CombinableInteractionsFields = {
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
    responseMimeType: b.responseMimeType ?? a.responseMimeType,
    tools: b.tools ?? a.tools,
    responseModalities: b.responseModalities ?? a.responseModalities,
    enableEnhancedCivicAnswers:
      b.enableEnhancedCivicAnswers ?? a.enableEnhancedCivicAnswers,
    thinkingConfig: b.thinkingConfig ?? a.thinkingConfig,
    speechConfig: b.speechConfig ?? a.speechConfig,
    imageConfig: b.imageConfig ?? a.imageConfig,
    mediaResolution: b.mediaResolution ?? a.mediaResolution,
    detail: b.detail ?? a.detail,
    maxReasoningTokens: b.maxReasoningTokens ?? a.maxReasoningTokens,
    thinkingBudget: b.thinkingBudget ?? a.thinkingBudget,
    reasoningEffort: b.reasoningEffort ?? a.reasoningEffort,
    thinkingLevel: b.thinkingLevel ?? a.thinkingLevel,
    serviceTier: b.serviceTier ?? a.serviceTier,
    responseFormat: b.responseFormat ?? a.responseFormat,
    previousInteractionId: b.previousInteractionId ?? a.previousInteractionId,
    store: b.store ?? a.store,
    background: b.background ?? a.background,
    agent: b.agent ?? a.agent,
    agentConfig: b.agentConfig ?? a.agentConfig,
    webhookConfig: b.webhookConfig ?? a.webhookConfig,
  };
  if (rest.length > 0) {
    return combineInteractionsFields(combined, rest[0], ...rest.slice(1));
  }
  return combined;
}

/**
 * Converts reasoning/thinking fields (`reasoningEffort`, `thinkingLevel`,
 * `maxReasoningTokens`, `thinkingBudget`, or `thinkingConfig`) into the
 * Interactions API `thinking_level` and `thinking_summaries` fields on
 * `generation_config`.
 */
export function convertFieldsToInteractionsThinking(
  model: string,
  fields: ChatGoogleFields
): {
  thinking_level?: Gemini.Interactions.ThinkingLevel;
  thinking_summaries?: "auto" | "none";
} {
  const explicitThinkingConfig = fields.thinkingConfig;
  const computedThinkingConfig = convertFieldsToThinkingConfig(model, fields);
  const thinkingConfig = explicitThinkingConfig ?? computedThinkingConfig;

  if (!thinkingConfig) {
    return {};
  }

  let thinkingSummaries: "auto" | "none" | undefined;
  if (typeof thinkingConfig.includeThoughts === "boolean") {
    thinkingSummaries = thinkingConfig.includeThoughts ? "auto" : "none";
  }

  let levelRaw: string | undefined =
    thinkingConfig.thinkingLevel ??
    computedThinkingConfig?.thinkingLevel ??
    fields.reasoningEffort ??
    fields.thinkingLevel;

  if (!levelRaw && typeof thinkingConfig.thinkingBudget === "number") {
    levelRaw = convertReasoningTokensToReasoningEffort(
      model,
      thinkingConfig.thinkingBudget
    );
  }

  const normalizedLevel = levelRaw?.toLowerCase() as
    | Gemini.Interactions.ThinkingLevel
    | undefined;

  return {
    ...(normalizedLevel ? { thinking_level: normalizedLevel } : {}),
    ...(thinkingSummaries ? { thinking_summaries: thinkingSummaries } : {}),
  };
}

/**
 * Converts `speechConfig` (either simplified or GenerateContent `SpeechConfig`)
 * into the Interactions API `Array<Gemini.Interactions.SpeechConfig>` format.
 */
export function convertFieldsToInteractionsSpeechConfig(
  fields: ChatGoogleFields
): Array<Gemini.Interactions.SpeechConfig> | undefined {
  if (typeof fields.speechConfig === "undefined") {
    return undefined;
  }

  // If already passed as an array of Interactions SpeechConfig objects, return as-is
  if (
    Array.isArray(fields.speechConfig) &&
    fields.speechConfig.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        ("voice" in item || "language" in item || "speaker" in item)
    )
  ) {
    return fields.speechConfig as unknown as Array<Gemini.Interactions.SpeechConfig>;
  }

  const genSpeechConfig = convertFieldsToSpeechConfig(fields);
  if (!genSpeechConfig) {
    return undefined;
  }

  const language = genSpeechConfig.languageCode;

  if (genSpeechConfig.multiSpeakerVoiceConfig?.speakerVoiceConfigs) {
    return genSpeechConfig.multiSpeakerVoiceConfig.speakerVoiceConfigs.map(
      (speakerConfig): Gemini.Interactions.SpeechConfig => ({
        ...(speakerConfig.speaker ? { speaker: speakerConfig.speaker } : {}),
        ...(speakerConfig.voiceConfig?.prebuiltVoiceConfig?.voiceName
          ? { voice: speakerConfig.voiceConfig.prebuiltVoiceConfig.voiceName }
          : {}),
        ...(language ? { language } : {}),
      })
    );
  }

  const voice = genSpeechConfig.voiceConfig?.prebuiltVoiceConfig?.voiceName;
  if (voice || language) {
    return [
      {
        ...(voice ? { voice } : {}),
        ...(language ? { language } : {}),
      },
    ];
  }

  return undefined;
}

/**
 * Converts a GenerateContent `ImageConfig` (camelCase) or Interactions `ImageResponseFormat`
 * (snake_case) into an Interactions `ImageResponseFormat` (omitting `type`).
 */
export function convertFieldsToInteractionsImageConfig(
  imageConfig?:
    | Gemini.GenContent.ImageConfig
    | Partial<Gemini.Interactions.ImageResponseFormat>
): Omit<Gemini.Interactions.ImageResponseFormat, "type"> | undefined {
  if (!imageConfig) {
    return undefined;
  }

  const raw = imageConfig as Gemini.GenContent.ImageConfig &
    Partial<Gemini.Interactions.ImageResponseFormat>;
  const aspectRatio = raw.aspect_ratio ?? raw.aspectRatio;
  const imageSize = raw.image_size ?? raw.imageSize;
  const mimeType = raw.mime_type;
  const delivery = raw.delivery;

  if (!aspectRatio && !imageSize && !mimeType && !delivery) {
    return undefined;
  }

  return {
    ...(aspectRatio
      ? {
          aspect_ratio:
            aspectRatio as Gemini.Interactions.ImageResponseFormat["aspect_ratio"],
        }
      : {}),
    ...(imageSize
      ? {
          image_size:
            imageSize as Gemini.Interactions.ImageResponseFormat["image_size"],
        }
      : {}),
    ...(mimeType ? { mime_type: mimeType } : {}),
    ...(delivery ? { delivery } : {}),
  };
}

/**
 * Maps `mediaResolution` (GenerateContent enum or lowercase) or `detail` ("low" | "high" | "auto")
 * to the Interactions API `MediaResolution` ("low" | "medium" | "high" | "ultra_high").
 */
export function convertMediaResolutionToInteractions(
  mediaResolution?:
    | Gemini.Shared.MediaResolution
    | Gemini.Interactions.MediaResolution,
  detail?: ChatGoogleFields["detail"]
): Gemini.Interactions.MediaResolution | undefined {
  const resolved = mediaResolution ?? mapDetailToMediaResolution(detail);
  if (!resolved) {
    return undefined;
  }

  const normalized = resolved.toLowerCase();
  if (normalized === "media_resolution_low" || normalized === "low") {
    return "low";
  }
  if (normalized === "media_resolution_medium" || normalized === "medium") {
    return "medium";
  }
  if (normalized === "media_resolution_high" || normalized === "high") {
    return "high";
  }
  if (
    normalized === "media_resolution_ultra_high" ||
    normalized === "ultra_high"
  ) {
    return "ultra_high";
  }
  return undefined;
}

/**
 * Maps GenerateContent `SafetySetting[]` (`HARM_CATEGORY_*`, `BLOCK_*`) into
 * Interactions API `SafetySetting[]` (`{ type, threshold }` in lowercase snake_case).
 */
export function convertSafetySettingsToInteractions(
  safetySettings?: Gemini.Shared.SafetySetting[]
): Gemini.Interactions.SafetySetting[] | undefined {
  if (!safetySettings || safetySettings.length === 0) {
    return undefined;
  }

  const result: Gemini.Interactions.SafetySetting[] = [];
  for (const setting of safetySettings) {
    const rawSetting = setting as Gemini.Shared.SafetySetting &
      Partial<Gemini.Interactions.SafetySetting>;
    const rawCategory = (
      rawSetting.category ??
      rawSetting.type ??
      ""
    ).toLowerCase();
    const type = (
      rawCategory.startsWith("harm_category_")
        ? rawCategory.slice("harm_category_".length)
        : rawCategory
    ) as Gemini.Interactions.SafetySetting["type"];

    const rawThreshold = (rawSetting.threshold ?? "").toLowerCase();
    const threshold = (
      rawThreshold === "harm_block_threshold_unspecified" || !rawThreshold
        ? undefined
        : rawThreshold
    ) as Gemini.Interactions.SafetySetting["threshold"] | undefined;

    if (type && threshold && type !== ("unspecified" as string)) {
      result.push({
        type,
        threshold,
        ...(rawSetting.method ? { method: rawSetting.method } : {}),
      });
    }
  }

  return result.length > 0 ? result : undefined;
}

/**
 * Translates `responseModalities` into the Interactions API `response_modalities` array
 * (lowercase `"text" | "image" | "audio" | "video" | "document"`).
 */
export function convertFieldsToInteractionsResponseModalities(
  fields: ChatGoogleFields
): Array<Gemini.Interactions.ResponseModality> | undefined {
  if (!fields.responseModalities || fields.responseModalities.length === 0) {
    return undefined;
  }
  const modalities: Gemini.Interactions.ResponseModality[] = [];
  for (const m of fields.responseModalities) {
    const lower = m.toLowerCase();
    if (
      lower === "text" ||
      lower === "image" ||
      lower === "audio" ||
      lower === "video" ||
      lower === "document"
    ) {
      modalities.push(lower);
    }
  }
  return modalities.length > 0 ? modalities : undefined;
}

/**
 * Translates `responseFormat`, `responseSchema`, `responseModalities`, `responseMimeType`,
 * and `imageConfig` into the Interactions API `response_format` field.
 */
export function convertFieldsToInteractionsResponseFormat(
  fields: ChatGoogleFields
): Gemini.Interactions.CreateInteractionParameters["response_format"] {
  if (fields.responseFormat) {
    return fields.responseFormat;
  }

  if (fields.responseSchema) {
    if (
      isInteropZodSchema(fields.responseSchema) ||
      isSerializableSchema(fields.responseSchema)
    ) {
      return toJsonSchema(fields.responseSchema) as Record<string, unknown>;
    }
    return fields.responseSchema as Record<string, unknown>;
  }

  if (fields.responseModalities && fields.responseModalities.length === 1) {
    const modality = fields.responseModalities[0].toUpperCase();
    if (modality === "IMAGE") {
      const imageConfig = convertFieldsToInteractionsImageConfig(
        fields.imageConfig
      );
      return {
        type: "image",
        ...(imageConfig ?? {}),
        ...(fields.responseMimeType
          ? {
              mime_type:
                fields.responseMimeType as Gemini.Interactions.ImageResponseFormat["mime_type"],
            }
          : {}),
      };
    }
    if (modality === "AUDIO") {
      return {
        type: "audio",
        ...(fields.responseMimeType
          ? {
              mime_type:
                fields.responseMimeType as Gemini.Interactions.AudioResponseFormat["mime_type"],
            }
          : {}),
      };
    }
    if (modality === "VIDEO") {
      return {
        type: "video",
        ...(fields.responseMimeType
          ? {
              mime_type:
                fields.responseMimeType as Gemini.Interactions.VideoResponseFormat["mime_type"],
            }
          : {}),
      };
    }
    if (modality === "TEXT" && fields.responseMimeType) {
      return {
        type: "text",
        mime_type:
          fields.responseMimeType as Gemini.Interactions.TextResponseFormat["mime_type"],
      };
    }
  }

  if (fields.responseMimeType && fields.responseMimeType !== "application/json") {
    if (fields.responseMimeType.startsWith("image/")) {
      const imageConfig = convertFieldsToInteractionsImageConfig(
        fields.imageConfig
      );
      return {
        type: "image",
        ...(imageConfig ?? {}),
        mime_type:
          fields.responseMimeType as Gemini.Interactions.ImageResponseFormat["mime_type"],
      };
    }
    if (fields.responseMimeType.startsWith("audio/")) {
      return {
        type: "audio",
        mime_type:
          fields.responseMimeType as Gemini.Interactions.AudioResponseFormat["mime_type"],
      };
    }
    if (fields.responseMimeType.startsWith("video/")) {
      return {
        type: "video",
        mime_type:
          fields.responseMimeType as Gemini.Interactions.VideoResponseFormat["mime_type"],
      };
    }
  }

  return undefined;
}

/**
 * Builds an object containing `service_tier` when supported by the target platform.
 */
export function convertFieldsToInteractionsServiceTier(
  platform: GooglePlatformType,
  fields: ChatGoogleFields
): {
  service_tier?: Gemini.Interactions.CreateInteractionParameters["service_tier"];
} {
  if (platform === "gcp") {
    return {};
  }

  const serviceTier = fields.serviceTier;
  if (!serviceTier || !settableServiceTier.includes(serviceTier)) {
    return {};
  }

  return {
    service_tier: serviceTier,
  };
}
