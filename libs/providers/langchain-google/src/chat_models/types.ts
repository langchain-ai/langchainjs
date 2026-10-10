/* oxlint-disable @typescript-eslint/no-namespace */

import type { InteropZodType } from "@langchain/core/utils/types";
import type { SerializableSchema } from "@langchain/core/utils/standard_schema";
import type {
  BaseChatModelParams,
  BaseChatModelCallOptions,
  BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import type { AsyncCaller } from "@langchain/core/utils/async_caller";
import type { ApiClient } from "../clients/index.js";
import type { GenContent as GenContentNamespace } from "./api_types/generate_content.js";
import type { LowercaseLiteral, Prettify } from "../utils/misc.js";
import type { GoogleChatApiHandler } from "./handlers/base.js";

export interface BaseChatGoogleFields {
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
   * A list of tools the model may use to generate the next response.
   * Can be LangChain tools, OpenAI tools, or Gemini function declarations.
   */
  tools?: BindToolsInput[];

  /**
   * OpenAI-compatible alias for media input detail level.
   *
   * This is mapped to `generationConfig.mediaResolution`:
   * - `"auto"` => default Gemini behavior (`mediaResolution` omitted)
   * - `"low"` => `"MEDIA_RESOLUTION_LOW"`
   * - `"high"` => `"MEDIA_RESOLUTION_HIGH"`
   *
   * If both `mediaResolution` and `detail` are provided, `mediaResolution` wins.
   */
  detail?: "auto" | "low" | "high";

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
  reasoningEffort?: Gemini.Shared.ThinkingLevel;

  /**
   * An alias for `reasoningEffort` for compatibility.
   */
  thinkingLevel?: Gemini.Shared.ThinkingLevel;

  /**
   * Custom / additional headers to include with every request to the API.
   * When set on both constructor params and per-invocation call options,
   * per-invocation headers take precidence for matching keys.
   */
  customHeaders?: Record<string, string>;

  /**
   * Per request settings for blocking unsafe content
   */
  safetySettings?: Prettify<Gemini.Shared.SafetySetting>[];

  /**
   * Media resolution for input media processing.
   *
   * This maps to `generationConfig.mediaResolution`, which is a scalar enum-like
   * string value in the Gemini API.
   */
  mediaResolution?: Gemini.Shared.MediaResolution;
}

export interface GenerateContentSpecificFields {
  /**
   * The schema that the generated response should match.
   * Can be a Zod schema or a JSON Schema object.
   * When set, the response will be structured according to this schema
   * and `responseMimeType` will automatically be set to "application/json".
   */
  responseSchema?:
    | InteropZodType
    | SerializableSchema
    | Record<string, unknown>;

  /**
   * Desired MIME type of the generated candidate content.
   */
  responseMimeType?: string;

  /**
   * The requested modalities of the response.
   * Represents the set of modalities that the model can return.
   * An empty list is equivalent to requesting only text.
   */
  responseModalities?: Prettify<GenContentNamespace.GenerativeLanguageModality>[];

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
   * Configuration for the model's thinking process
   */
  thinkingConfig?: Prettify<GenContentNamespace.ThinkingConfig>;

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
  speechConfig?:
    | Prettify<GenContentNamespace.SpeechConfig>
    | SimplifiedSpeechConfig;

  /**
   * Configuration for image generation.
   */
  imageConfig?: Prettify<GenContentNamespace.ImageConfig>;

  /**
   * Inference service tiers.
   * "priority" offers highest reliability for higher rates.
   * "flex" offers a discount for preemptable processing.
   * Other values are treated as the standard service tier.
   */
  serviceTier?: GenContentNamespace.ServiceTier;
}

export interface GenerateContentFields
  extends BaseChatGoogleFields, GenerateContentSpecificFields {}

export interface ChatGoogleFields
  extends BaseChatGoogleFields, Partial<GenerateContentSpecificFields> {}

export type GooglePlatformType = "gai" | "gcp";

export interface BaseChatGoogleParams
  extends BaseChatModelParams, ChatGoogleFields {
  model: string;
  apiClient?: ApiClient;
  endpoint?: string;
  location?: string;
  apiVersion?: string;
  platformType?: GooglePlatformType;
  vertexai?: boolean;
  streaming?: boolean;
  streamUsage?: boolean;
  apiHandler?: GoogleChatApiHandlerConfig;
}

export interface BaseChatGoogleCallOptions
  extends BaseChatModelCallOptions, ChatGoogleFields {
  streamUsage?: boolean;
}

export interface GoogleChatApiHandlerParams
  extends BaseChatModelParams, BaseChatGoogleFields {
  apiClient: ApiClient;
  caller: AsyncCaller;
  model: string;
  platform: GooglePlatformType;
  endpoint?: string;
  location?: string;
  apiVersion?: string;
  isVertexExpress?: boolean;
  publisher?: string;
  streaming?: boolean;
  streamUsage?: boolean;
  customHeaders?: Record<string, string>;
}

export interface GenerateContentApiHandlerParams
  extends GoogleChatApiHandlerParams, GenerateContentSpecificFields {}

export type GoogleChatApiHandlerFactory = (
  params: GoogleChatApiHandlerParams
) => GoogleChatApiHandler;

export type GoogleChatApiHandlerConfig =
  | "generateContent"
  | GoogleChatApiHandlerFactory;

export type GenerateContentInvocationParams = Partial<
  Omit<GenContentNamespace.GenerateContentRequest, "contents">
> & {
  serviceTier?: GenContentNamespace.ServiceTier;
};

// These are service tiers that we specifically need to send.
// Other values will be ignored, resulting in the default
// or "standard" setting.
export const settableServiceTier: GenContentNamespace.ServiceTier[] = [
  "flex",
  "priority",
];

// 1. Augment GenContent so internal references in generated types resolve
declare module "./api_types/generate_content.js" {
  export namespace GenContent {
    // Gemini parts are contained as one intersecting type
    // in the spec, so we need to pick out the specific parts we need.
    export namespace Part {
      export type CodeExecutionResult = Pick<
        GenContentNamespace.Part,
        "codeExecutionResult"
      >;
      export type ExecutableCode = Pick<
        GenContentNamespace.Part,
        "executableCode"
      >;
      export type FileData = Pick<
        GenContentNamespace.Part,
        "fileData" | "videoMetadata"
      >;
      export type FunctionCall = Required<
        Pick<GenContentNamespace.Part, "functionCall">
      > &
        Pick<GenContentNamespace.Part, "thoughtSignature">;
      export type FunctionResponse = Pick<
        GenContentNamespace.Part,
        "functionResponse"
      >;
      export type InlineData = Pick<
        GenContentNamespace.Part,
        "inlineData" | "videoMetadata"
      >;
      export type MediaResolution = Pick<
        GenContentNamespace.Part,
        "mediaResolution"
      >;
      export type PartMetadata = Pick<GenContentNamespace.Part, "partMetadata">;
      export type Text = Pick<GenContentNamespace.Part, "text">;
      export type Thought = Pick<GenContentNamespace.Part, "thought">;
      export type ThoughtSignature = Pick<
        GenContentNamespace.Part,
        "thoughtSignature"
      >;
    }

    export namespace PrebuiltVoiceConfig {
      /**
       * The name of a prebuilt voice that can be used for speech synthesis.
       *
       * Extracted as a non-nullable type from the PrebuiltVoiceConfig["voiceName"] property.
       */
      export type VoiceName = NonNullable<
        GenContentNamespace.PrebuiltVoiceConfig["voiceName"]
      >;
    }

    export namespace SpeakerVoiceConfig {
      /**
       * The speaker identifier for a custom or multi-speaker TTS configuration.
       *
       * Extracted as a non-nullable type from the SpeakerVoiceConfig["speaker"] property.
       */
      export type Speaker = NonNullable<
        GenContentNamespace.SpeakerVoiceConfig["speaker"]
      >;
    }

    export namespace SpeechConfig {
      /**
       * The BCP-47 language code for speech synthesis (e.g., "en-US").
       *
       * Extracted as a non-nullable type from the SpeechConfig["languageCode"] property.
       */
      export type LanguageCode = NonNullable<
        GenContentNamespace.SpeechConfig["languageCode"]
      >;
    }

    /**
     * The level of "thinking" or reasoning configured for the model.
     *
     * Extends ThinkingConfig["thinkingLevel"] to also accept
     * lowercase variants (e.g. "high" in addition to "HIGH").
     */
    export type ThinkingLevel =
      | GenContentNamespace.ThinkingConfig["thinkingLevel"]
      | LowercaseLiteral<GenContentNamespace.ThinkingConfig["thinkingLevel"]>;

    /**
     * The role of a content message. The spec types this as `string`, but
     * the API only accepts these specific values.
     */
    export type Role = "user" | "model" | "function";

    /**
     * Alias for the unwieldy generated grounding support type name.
     */
    export type GroundingSupport =
      GenContentNamespace.GoogleAiGenerativelanguageV1betaGroundingSupport;

    /**
     * Alias for the unwieldy generated segment type name.
     */
    export type Segment =
      GenContentNamespace.GoogleAiGenerativelanguageV1betaSegment;

    export namespace Tools {
      /**
       * The mode for function calling configuration, extracted from the
       * FunctionCallingConfig interface.
       */
      export type FunctionCallingConfigMode =
        GenContentNamespace.Tools.FunctionCallingConfig["mode"];
    }

    /**
     * Legacy URL retrieval metadata (predecessor of UrlContextMetadata).
     * Not in the current OpenAPI spec but still returned by the API.
     */
    export interface UrlRetrievalMetadata {
      urlRetrievalContexts?: Array<GenContentNamespace.UrlMetadata>;
    }

    // Augment Candidate with legacy field the API still returns.
    export interface Candidate {
      /** @deprecated Use urlContextMetadata instead. */
      readonly urlRetrievalMetadata?: UrlRetrievalMetadata;
    }
  }
}

// 2. Expose the Gemini composite namespace
export declare namespace Gemini {
  export namespace Shared {
    export type HarmCategory = GenContentNamespace.HarmCategory;
    export type SafetySetting = GenContentNamespace.SafetySetting;
    export type MediaResolution =
      GenContentNamespace.GenerationConfig["mediaResolution"];
    export type ThinkingLevel = GenContentNamespace.ThinkingLevel;
  }

  export namespace GenContent {
    export type Content = GenContentNamespace.Content;
    export type Candidate = GenContentNamespace.Candidate;
    export type GenerateContentRequest =
      GenContentNamespace.GenerateContentRequest;
    export type GenerateContentResponse =
      GenContentNamespace.GenerateContentResponse;
    export type GenerationConfig = GenContentNamespace.GenerationConfig;
    export type SafetyRating = GenContentNamespace.SafetyRating;
    export type SafetySetting = GenContentNamespace.SafetySetting;
    export type PromptFeedback = GenContentNamespace.PromptFeedback;
    export type Tool = GenContentNamespace.Tool;
    export type ThinkingConfig = GenContentNamespace.ThinkingConfig;
    export type ThinkingLevel = GenContentNamespace.ThinkingLevel;
    export type SpeechConfig = GenContentNamespace.SpeechConfig;
    export namespace SpeechConfig {
      export type LanguageCode = GenContentNamespace.SpeechConfig.LanguageCode;
    }
    export type PrebuiltVoiceConfig = GenContentNamespace.PrebuiltVoiceConfig;
    export namespace PrebuiltVoiceConfig {
      export type VoiceName = GenContentNamespace.PrebuiltVoiceConfig.VoiceName;
    }
    export type SpeakerVoiceConfig = GenContentNamespace.SpeakerVoiceConfig;
    export namespace SpeakerVoiceConfig {
      export type Speaker = GenContentNamespace.SpeakerVoiceConfig.Speaker;
    }
    export type ServiceTier = GenContentNamespace.ServiceTier;
    export type Role = GenContentNamespace.Role;
    export type GroundingSupport = GenContentNamespace.GroundingSupport;
    export type GroundingMetadata = GenContentNamespace.GroundingMetadata;
    export type CitationMetadata = GenContentNamespace.CitationMetadata;
    export type UsageMetadata = GenContentNamespace.UsageMetadata;
    export type ModalityTokenCount = GenContentNamespace.ModalityTokenCount;
    export type Part = GenContentNamespace.Part;
    export namespace Part {
      export type CodeExecutionResult =
        GenContentNamespace.Part.CodeExecutionResult;
      export type ExecutableCode = GenContentNamespace.Part.ExecutableCode;
      export type FileData = GenContentNamespace.Part.FileData;
      export type FunctionCall = GenContentNamespace.Part.FunctionCall;
      export type FunctionResponse = GenContentNamespace.Part.FunctionResponse;
      export type InlineData = GenContentNamespace.Part.InlineData;
      export type MediaResolution = GenContentNamespace.Part.MediaResolution;
      export type PartMetadata = GenContentNamespace.Part.PartMetadata;
      export type Text = GenContentNamespace.Part.Text;
      export type Thought = GenContentNamespace.Part.Thought;
      export type ThoughtSignature = GenContentNamespace.Part.ThoughtSignature;
    }
    export namespace Tools {
      export type FunctionCallingConfigMode =
        GenContentNamespace.Tools.FunctionCallingConfigMode;
      export type FunctionDeclaration =
        GenContentNamespace.Tools.FunctionDeclaration;
      export type GoogleSearch = GenContentNamespace.Tools.GoogleSearch;
      export type CodeExecution = GenContentNamespace.Tools.CodeExecution;
      export type UrlContext = GenContentNamespace.Tools.UrlContext;
      export type GoogleMaps = GenContentNamespace.Tools.GoogleMaps;
      export type FileSearch = GenContentNamespace.Tools.FileSearch;
      export type ComputerUse = GenContentNamespace.Tools.ComputerUse;
      export type FunctionCallingConfig =
        GenContentNamespace.Tools.FunctionCallingConfig;
      export type RetrievalConfig = GenContentNamespace.Tools.RetrievalConfig;
      export type ToolConfig = GenContentNamespace.Tools.ToolConfig;
      export type Schema = GenContentNamespace.Tools.Schema;
      export type LatLng = GenContentNamespace.Tools.LatLng;
      export type Interval = GenContentNamespace.Tools.Interval;
      export type SearchTypes = GenContentNamespace.Tools.SearchTypes;
      export type Type = GenContentNamespace.Tools.Type;
      export type WebSearch = GenContentNamespace.Tools.WebSearch;
      export type ImageSearch = GenContentNamespace.Tools.ImageSearch;
    }
  }

  // Type aliases for generateContent wire types during Phase 1 transition
  export type Content = GenContentNamespace.Content;
  export type Candidate = GenContentNamespace.Candidate;
  export type GenerateContentRequest =
    GenContentNamespace.GenerateContentRequest;
  export type GenerateContentResponse =
    GenContentNamespace.GenerateContentResponse;
  export type GenerationConfig = GenContentNamespace.GenerationConfig;
  export type SafetyRating = GenContentNamespace.SafetyRating;
  export type SafetySetting = GenContentNamespace.SafetySetting;
  export type PromptFeedback = GenContentNamespace.PromptFeedback;
  export type Tool = GenContentNamespace.Tool;
  export type ThinkingConfig = GenContentNamespace.ThinkingConfig;
  export type ThinkingLevel = GenContentNamespace.ThinkingLevel;
  export type SpeechConfig = GenContentNamespace.SpeechConfig;
  export namespace SpeechConfig {
    export type LanguageCode = GenContentNamespace.SpeechConfig.LanguageCode;
  }
  export type PrebuiltVoiceConfig = GenContentNamespace.PrebuiltVoiceConfig;
  export namespace PrebuiltVoiceConfig {
    export type VoiceName = GenContentNamespace.PrebuiltVoiceConfig.VoiceName;
  }
  export type SpeakerVoiceConfig = GenContentNamespace.SpeakerVoiceConfig;
  export namespace SpeakerVoiceConfig {
    export type Speaker = GenContentNamespace.SpeakerVoiceConfig.Speaker;
  }
  export type ServiceTier = GenContentNamespace.ServiceTier;
  export type Role = GenContentNamespace.Role;
  export type GroundingSupport = GenContentNamespace.GroundingSupport;
  export type GroundingMetadata = GenContentNamespace.GroundingMetadata;
  export type CitationMetadata = GenContentNamespace.CitationMetadata;
  export type UsageMetadata = GenContentNamespace.UsageMetadata;
  export type ModalityTokenCount = GenContentNamespace.ModalityTokenCount;

  export type Part = GenContentNamespace.Part;
  export namespace Part {
    export type CodeExecutionResult =
      GenContentNamespace.Part.CodeExecutionResult;
    export type ExecutableCode = GenContentNamespace.Part.ExecutableCode;
    export type FileData = GenContentNamespace.Part.FileData;
    export type FunctionCall = GenContentNamespace.Part.FunctionCall;
    export type FunctionResponse = GenContentNamespace.Part.FunctionResponse;
    export type InlineData = GenContentNamespace.Part.InlineData;
    export type MediaResolution = GenContentNamespace.Part.MediaResolution;
    export type PartMetadata = GenContentNamespace.Part.PartMetadata;
    export type Text = GenContentNamespace.Part.Text;
    export type Thought = GenContentNamespace.Part.Thought;
    export type ThoughtSignature = GenContentNamespace.Part.ThoughtSignature;
  }

  export namespace Tools {
    export type FunctionCallingConfigMode =
      GenContentNamespace.Tools.FunctionCallingConfigMode;
    export type FunctionDeclaration =
      GenContentNamespace.Tools.FunctionDeclaration;
    export type GoogleSearch = GenContentNamespace.Tools.GoogleSearch;
    export type CodeExecution = GenContentNamespace.Tools.CodeExecution;
    export type UrlContext = GenContentNamespace.Tools.UrlContext;
    export type GoogleMaps = GenContentNamespace.Tools.GoogleMaps;
    export type FileSearch = GenContentNamespace.Tools.FileSearch;
    export type ComputerUse = GenContentNamespace.Tools.ComputerUse;
    export type FunctionCallingConfig =
      GenContentNamespace.Tools.FunctionCallingConfig;
    export type RetrievalConfig = GenContentNamespace.Tools.RetrievalConfig;
    export type ToolConfig = GenContentNamespace.Tools.ToolConfig;
    export type Schema = GenContentNamespace.Tools.Schema;
    export type LatLng = GenContentNamespace.Tools.LatLng;
    export type Interval = GenContentNamespace.Tools.Interval;
    export type SearchTypes = GenContentNamespace.Tools.SearchTypes;
    export type Type = GenContentNamespace.Tools.Type;
    export type WebSearch = GenContentNamespace.Tools.WebSearch;
    export type ImageSearch = GenContentNamespace.Tools.ImageSearch;
  }
}

export type { GenContentNamespace as GenContent };

/**
 * Simplified speaker/name pair for multi-speaker config.
 * - `speaker` derived from SpeakerVoiceConfig["speaker"]
 * - `name` is the prebuilt voice name
 */
export interface SpeechSpeakerName {
  speaker: Gemini.GenContent.SpeakerVoiceConfig.Speaker;
  name: Gemini.GenContent.PrebuiltVoiceConfig.VoiceName;
}

/** A voice can be a prebuilt voice name, a speaker/name pair, or an array of pairs */
export type SpeechVoice =
  | Gemini.GenContent.PrebuiltVoiceConfig.VoiceName
  | SpeechSpeakerName
  | SpeechSpeakerName[];

/** Voice with language code (derived from SpeechConfig's languageCode) */
export interface SpeechVoiceLanguage {
  voice: SpeechVoice;
  languageCode: Gemini.GenContent.SpeechConfig.LanguageCode;
}

/** Voices with language code */
export interface SpeechVoicesLanguage {
  voices: SpeechVoice;
  languageCode: Gemini.GenContent.SpeechConfig.LanguageCode;
}

/** Simplified language config (with voice or voices) */
export type SimplifiedSpeechLanguageConfig =
  | SpeechVoiceLanguage
  | SpeechVoicesLanguage;

/** Top-level simplified config: just a voice, or voice+language */
export type SimplifiedSpeechConfig =
  | SpeechVoice
  | SimplifiedSpeechLanguageConfig;
