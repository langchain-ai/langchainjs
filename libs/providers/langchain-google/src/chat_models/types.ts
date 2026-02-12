/* eslint-disable @typescript-eslint/no-namespace */

import type { InteropZodType } from "@langchain/core/utils/types";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import type { Gemini as GeminiBase } from "./api-types.js";
import type { Prettify } from "../utils/misc.js";

export interface ChatGoogleFields {
  /**
   * The temperature is used for sampling during response generation, which
   * occurs when topP and topK are applied. Temperature controls the degree of
   * randomness in token selection. Lower temperatures are good for prompts that
   * require a less open-ended or creative response, while higher temperatures
   * can lead to more diverse or creative results.
   *
   * Specify a lower value for less random responses and a higher value for more
   * random responses.
   */
  temperature?: number;

  /**
   * Top-P changes how the model selects tokens for output. Tokens are selected
   * from the most probable to least probable until the sum of their
   * probabilities equals the top-P value.
   *
   * Specify a lower value for less random responses and a higher value for more
   * random responses.
   */
  topP?: number;

  /**
   * Top-K changes how the model selects tokens for output. A top-K of 1 means
   * the selected token is the most probable among all tokens in the model's
   * vocabulary (also called greedy decoding), while a top-K of 3 means that the
   * next token is selected from among the 3 most probable tokens (using
   * temperature).
   */
  topK?: number;

  /**
   * Maximum number of tokens that can be generated in the response. A token is
   * approximately four characters. 100 tokens correspond to roughly 60-80 words.
   * Specify a lower value for shorter responses and a higher value for
   * potentially longer responses.
   */
  maxOutputTokens?: number;

  /**
   * Positive values penalize tokens that already appear in the generated text,
   * increasing the probability of generating more diverse content.
   */
  presencePenalty?: number;

  /**
   * Positive values penalize tokens that repeatedly appear in the generated
   * text, decreasing the probability of repeating content.
   */
  frequencyPenalty?: number;

  /**
   * Specifies a list of strings that tells the model to stop generating text if
   * one of the strings is encountered in the response. If a string appears
   * multiple times in the response, then the response truncates where it's
   * first encountered. The strings are case-sensitive.
   */
  stopSequences?: string[];

  /**
   * When seed is fixed to a specific value, the model makes a best effort to
   * provide the same response for repeated requests. Deterministic output isn't
   * guaranteed. Also, changing the model or parameter settings, such as the
   * temperature, can cause variations in the response even when you use the
   * same seed value. By default, a random seed value is used.
   */
  seed?: number;

  /**
   * If true, returns the log probabilities of the tokens that were chosen by
   * the model at each step. By default, this parameter is set to false.
   */
  responseLogprobs?: boolean;

  /**
   * Returns the log probabilities of the top candidate tokens at each generation
   * step. The model's chosen token might not be the same as the top candidate
   * token at each step. Specify the number of candidates to return by using an
   * integer value in the range of 1-20.
   */
  logprobs?: number;

  /**
   * Per request settings for blocking unsafe content
   */
  safetySettings?: Prettify<GeminiBase.SafetySetting>[];

  /**
   * Configuration for the model's thinking process
   */
  thinkingConfig?: Prettify<GeminiBase.ThinkingConfig>;

  /**
   * The schema that the generated response should match.
   * Can be a Zod schema or a JSON Schema object.
   * When set, the response will be structured according to this schema
   * and `responseMimeType` will automatically be set to "application/json".
   */
  responseSchema?: InteropZodType | Record<string, unknown>;

  /**
   * A list of tools the model may use to generate the next response.
   * Can be LangChain tools, OpenAI tools, or Gemini function declarations.
   */
  tools?: BindToolsInput[];

  /**
   * The requested modalities of the response.
   * Represents the set of modalities that the model can return.
   * An empty list is equivalent to requesting only text.
   */
  responseModalities?: Prettify<GeminiBase.GenerativeLanguageModality>[];

  /**
   * If true, enables enhanced civic answers feature.
   */
  enableEnhancedCivicAnswers?: boolean;

  /**
   * Speech generation configuration.
   * You can use either Google's definition of the speech configuration,
   * or a simplified version we've defined (which can be as simple
   * as the name of a pre-defined voice).
   */
  speechConfig?: Prettify<GeminiBase.SpeechConfig> | SimplifiedSpeechConfig;

  /**
   * Configuration for image generation.
   */
  imageConfig?: Prettify<GeminiBase.ImageConfig>;

  /**
   * Media resolution for input media processing.
   */
  mediaResolution?: Prettify<GeminiBase.MediaResolution>;

  /**
   * The number of reasoning tokens that the model should generate.
   * If explicitly set, then the reasoning blocks will be returned.
   */
  maxReasoningTokens?: number;

  /**
   * An alias for `maxReasoningTokens` for compatibility.
   */
  thinkingBudget?: number;

  /**
   * An alias for `maxReasoningTokens` under Gemini 2.5 or
   * the primary thinking/reasoning setting for Gemini 3.
   * If explicitly set, then the reasoning blocks will be returned.
   */
  reasoningEffort?: GeminiBase.ThinkingLevel;

  /**
   * An alias for `reasoningEffort` for compatibility.
   */
  thinkingLevel?: GeminiBase.ThinkingLevel;
}

export type GooglePlatformType = "gai" | "gcp";

export { type Gemini } from "./api-types.js";

// There's a fair number of utilities that we need to extract from the base
// Gemini OpenAPI types, Adding these directly to the base types
// would pollute the typegen output, so we're adding them here instead.
declare module "./api-types.js" {
  export namespace Gemini {
    // Gemini parts are contained as one intersecting type
    // in the spec, so we need to pick out the specific parts we need.
    export namespace Part {
      export type CodeExecutionResult = Pick<
        GeminiBase.Part,
        "codeExecutionResult"
      >;
      export type ExecutableCode = Pick<GeminiBase.Part, "executableCode">;
      export type FileData = Pick<
        GeminiBase.Part,
        "fileData" | "videoMetadata"
      >;
      export type FunctionCall = Required<
        Pick<GeminiBase.Part, "functionCall">
      > &
        Pick<GeminiBase.Part, "thoughtSignature">;
      export type FunctionResponse = Pick<GeminiBase.Part, "functionResponse">;
      export type InlineData = Pick<
        GeminiBase.Part,
        "inlineData" | "videoMetadata"
      >;
      export type MediaResolution = Pick<GeminiBase.Part, "mediaResolution">;
      export type PartMetadata = Pick<GeminiBase.Part, "partMetadata">;
      export type Text = Pick<GeminiBase.Part, "text">;
      export type Thought = Pick<GeminiBase.Part, "thought">;
      export type ThoughtSignature = Pick<GeminiBase.Part, "thoughtSignature">;
    }

    export namespace PrebuiltVoiceConfig {
      /**
       * The name of a prebuilt voice that can be used for speech synthesis.
       *
       * Extracted as a non-nullable type from the GeminiBase.PrebuiltVoiceConfig["voiceName"] property.
       */
      export type VoiceName = NonNullable<
        GeminiBase.PrebuiltVoiceConfig["voiceName"]
      >;
    }

    export namespace SpeakerVoiceConfig {
      /**
       * The speaker identifier for a custom or multi-speaker TTS configuration.
       *
       * Extracted as a non-nullable type from the GeminiBase.SpeakerVoiceConfig["speaker"] property.
       */
      export type Speaker = NonNullable<
        GeminiBase.SpeakerVoiceConfig["speaker"]
      >;
    }

    export namespace SpeechConfig {
      /**
       * The BCP-47 language code for speech synthesis (e.g., "en-US").
       *
       * Extracted as a non-nullable type from the GeminiBase.SpeechConfig["languageCode"] property.
       */
      export type LanguageCode = NonNullable<
        GeminiBase.SpeechConfig["languageCode"]
      >;
    }

    /**
     * The level of "thinking" or reasoning configured for the model.
     *
     * Corresponds to GeminiBase.ThinkingConfig["thinkingLevel"].
     */
    export type ThinkingLevel = GeminiBase.ThinkingConfig["thinkingLevel"];

    /**
     * The role of a content message. The spec types this as `string`, but
     * the API only accepts these specific values.
     */
    export type Role = "user" | "model" | "function";

    /**
     * Alias for the unwieldy generated grounding support type name.
     */
    export type GroundingSupport =
      GeminiBase.GoogleAiGenerativelanguageV1betaGroundingSupport;

    /**
     * Alias for the unwieldy generated segment type name.
     */
    export type Segment = GeminiBase.GoogleAiGenerativelanguageV1betaSegment;

    export namespace Tools {
      /**
       * The mode for function calling configuration, extracted from the
       * FunctionCallingConfig interface.
       */
      export type FunctionCallingConfigMode =
        GeminiBase.Tools.FunctionCallingConfig["mode"];
    }

    /**
     * Legacy URL retrieval metadata (predecessor of UrlContextMetadata).
     * Not in the current OpenAPI spec but still returned by the API.
     */
    export interface UrlRetrievalMetadata {
      urlRetrievalContexts?: Array<GeminiBase.UrlMetadata>;
    }

    // Augment Candidate with legacy field the API still returns.
    export interface Candidate {
      /** @deprecated Use urlContextMetadata instead. */
      readonly urlRetrievalMetadata?: UrlRetrievalMetadata;
    }
  }
}

/**
 * Simplified speaker/name pair for multi-speaker config.
 * - `speaker` derived from SpeakerVoiceConfig["speaker"]
 * - `name` is the prebuilt voice name
 */
export interface SpeechSpeakerName {
  speaker: GeminiBase.SpeakerVoiceConfig.Speaker;
  name: GeminiBase.PrebuiltVoiceConfig.VoiceName;
}

/** A voice can be a prebuilt voice name, a speaker/name pair, or an array of pairs */
export type SpeechVoice =
  | GeminiBase.PrebuiltVoiceConfig.VoiceName
  | SpeechSpeakerName
  | SpeechSpeakerName[];

/** Voice with language code (derived from SpeechConfig's languageCode) */
export interface SpeechVoiceLanguage {
  voice: SpeechVoice;
  languageCode: GeminiBase.SpeechConfig.LanguageCode;
}

/** Voices with language code */
export interface SpeechVoicesLanguage {
  voices: SpeechVoice;
  languageCode: GeminiBase.SpeechConfig.LanguageCode;
}

/** Simplified language config (with voice or voices) */
export type SimplifiedSpeechLanguageConfig =
  | SpeechVoiceLanguage
  | SpeechVoicesLanguage;

/** Top-level simplified config: just a voice, or voice+language */
export type SimplifiedSpeechConfig =
  | SpeechVoice
  | SimplifiedSpeechLanguageConfig;
