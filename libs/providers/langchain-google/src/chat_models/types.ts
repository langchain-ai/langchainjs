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
import type { Interactions as InteractionsNamespace } from "./api_types/interactions.js";
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

export interface InteractionsSpecificFields {
  /**
   * Native Interactions API `response_format` configuration (JSON Schema or media response format).
   * Note: `responseSchema`, `responseModalities`, `responseMimeType`, and `imageConfig` are also
   * automatically translated into `response_format` when using the Interactions API.
   */
  responseFormat?: Gemini.Interactions.CreateInteractionParameters["response_format"];

  /**
   * The ID of a previous interaction to continue a stateful server-side conversation.
   */
  previousInteractionId?: string;

  /**
   * Whether to store the interaction on the server.
   */
  store?: boolean;

  /**
   * Whether to execute the interaction in the background (primarily for agents).
   */
  background?: boolean;

  /**
   * The name of the agent to use for the interaction (mutually exclusive with `model` in the raw API,
   * or used when invoking an agent endpoint).
   */
  agent?: string;

  /**
   * Configuration parameters for the specified agent.
   */
  agentConfig?: Gemini.Interactions.AgentConfig;

  /**
   * Optional webhook configuration for receiving asynchronous interaction events.
   */
  webhookConfig?: Gemini.Interactions.WebhookConfig;
}

export interface GenerateContentFields
  extends BaseChatGoogleFields, GenerateContentSpecificFields {}

export interface InteractionsFields
  extends
    BaseChatGoogleFields,
    GenerateContentSpecificFields,
    InteractionsSpecificFields {}

export interface ChatGoogleFields
  extends
    BaseChatGoogleFields,
    Partial<GenerateContentSpecificFields>,
    Partial<InteractionsSpecificFields> {}

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
  endpoint: string;
  location: string;
  apiVersion: string;
  isVertexExpress: boolean;
  publisher: string;
  streaming: boolean;
  streamUsage: boolean;
  customHeaders?: Record<string, string>;
}

export interface GenerateContentApiHandlerParams
  extends GoogleChatApiHandlerParams, GenerateContentSpecificFields {}

export interface InteractionsApiHandlerParams
  extends
    GoogleChatApiHandlerParams,
    GenerateContentSpecificFields,
    InteractionsSpecificFields {}

export type GoogleChatApiHandlerFactory = (
  params: GoogleChatApiHandlerParams
) => GoogleChatApiHandler;

export type GoogleChatApiHandlerConfig =
  | "generateContent"
  | "interactions"
  | GoogleChatApiHandlerFactory;

export type GenerateContentInvocationParams = Partial<
  Omit<GenContentNamespace.GenerateContentRequest, "contents">
> & {
  serviceTier?: GenContentNamespace.ServiceTier;
};

export type InteractionsInvocationParams = Partial<
  Omit<Gemini.Interactions.CreateInteractionParameters, "input">
>;

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
    export type ImageConfig = GenContentNamespace.ImageConfig;
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
  export type ImageConfig = GenContentNamespace.ImageConfig;
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

  export namespace Interactions {
    // =========================================================================
    // Narrowed Content & MediaProcessing types
    // Note: interactions-openapi.json uses JSON Schema `"const"` instead of
    // `"enum"` for `type` discriminators, which sparktype generates as
    // `type: unknown` in `./api_types/interactions.ts`. We narrow each
    // discriminator here so TypeScript discriminated unions work without
    // modifying the sparktype-generated file.
    // =========================================================================

    // Narrowed from InteractionsNamespace.StaticMediaProcessing because
    // interactions-openapi.json uses `"const": "static"`, which sparktype outputs as `unknown`.
    export type StaticMediaProcessing = Omit<
      InteractionsNamespace.StaticMediaProcessing,
      "type"
    > & {
      type: "static";
    };

    export type MediaProcessing = StaticMediaProcessing;

    // Narrowed from InteractionsNamespace.UrlCitation because
    // interactions-openapi.json uses `"const": "url_citation"`, which sparktype outputs as `unknown`.
    export type UrlCitation = Omit<InteractionsNamespace.UrlCitation, "type"> & {
      type: "url_citation";
    };

    // Narrowed from InteractionsNamespace.FileCitation because
    // interactions-openapi.json uses `"const": "file_citation"`, which sparktype outputs as `unknown`.
    export type FileCitation = Omit<
      InteractionsNamespace.FileCitation,
      "type"
    > & {
      type: "file_citation";
    };

    // Narrowed from InteractionsNamespace.PlaceCitation because
    // interactions-openapi.json uses `"const": "place_citation"`, which sparktype outputs as `unknown`.
    export type PlaceCitation = Omit<
      InteractionsNamespace.PlaceCitation,
      "type"
    > & {
      type: "place_citation";
    };

    // Narrowed from InteractionsNamespace.SpeechAnnotation because
    // interactions-openapi.json uses `"const": "speech_metadata"`, which sparktype outputs as `unknown`.
    export type SpeechAnnotation = Omit<
      InteractionsNamespace.SpeechAnnotation,
      "type"
    > & {
      type: "speech_metadata";
    };

    // Narrowed from InteractionsNamespace.WordInfo because
    // interactions-openapi.json uses `"const": "word_info"`, which sparktype outputs as `unknown`.
    export type WordInfo = Omit<InteractionsNamespace.WordInfo, "type"> & {
      type: "word_info";
    };

    // Narrowed union of Annotation types with literal `type` discriminators.
    export type Annotation =
      | UrlCitation
      | FileCitation
      | PlaceCitation
      | SpeechAnnotation
      | WordInfo;

    // Narrowed from InteractionsNamespace.TextContent because
    // interactions-openapi.json uses `"const": "text"`, which sparktype outputs as `unknown`.
    export type TextContent = Omit<
      InteractionsNamespace.TextContent,
      "type" | "annotations"
    > & {
      type: "text";
      annotations?: Array<Annotation>;
    };

    // Narrowed from InteractionsNamespace.ImageContent because
    // interactions-openapi.json uses `"const": "image"`, which sparktype outputs as `unknown`.
    export type ImageContent = Omit<InteractionsNamespace.ImageContent, "type"> & {
      type: "image";
    };

    // Narrowed from InteractionsNamespace.AudioContent because
    // interactions-openapi.json uses `"const": "audio"`, which sparktype outputs as `unknown`.
    export type AudioContent = Omit<
      InteractionsNamespace.AudioContent,
      "type"
    > & {
      type: "audio";
    };

    // Narrowed from InteractionsNamespace.DocumentContent because
    // interactions-openapi.json uses `"const": "document"`, which sparktype outputs as `unknown`.
    export type DocumentContent = Omit<
      InteractionsNamespace.DocumentContent,
      "type"
    > & {
      type: "document";
    };

    // Narrowed from InteractionsNamespace.VideoContent because
    // interactions-openapi.json uses `"const": "video"`, which sparktype outputs as `unknown`.
    export type VideoContent = Omit<
      InteractionsNamespace.VideoContent,
      "type" | "processing"
    > & {
      type: "video";
      processing?: MediaProcessing | "static" | "agentic" | (string & {});
    };

    // Narrowed union of Content types with literal `type` discriminators.
    export type Content =
      | TextContent
      | ImageContent
      | AudioContent
      | DocumentContent
      | VideoContent;

    // =========================================================================
    // Narrowed Step types
    // =========================================================================

    // Narrowed from InteractionsNamespace.UserInputStep because
    // interactions-openapi.json uses `"const": "user_input"`, which sparktype outputs as `unknown`.
    export type UserInputStep = Omit<
      InteractionsNamespace.UserInputStep,
      "type" | "content"
    > & {
      type: "user_input";
      content?: Array<Content> | string;
    };

    // Narrowed from InteractionsNamespace.ModelOutputStep because
    // interactions-openapi.json uses `"const": "model_output"`, which sparktype outputs as `unknown`.
    export type ModelOutputStep = Omit<
      InteractionsNamespace.ModelOutputStep,
      "type" | "content"
    > & {
      type: "model_output";
      content?: Array<Content> | string;
    };

    // Narrowed from InteractionsNamespace.ThoughtStep because
    // interactions-openapi.json uses `"const": "thought"`, which sparktype outputs as `unknown`.
    export type ThoughtStep = Omit<
      InteractionsNamespace.ThoughtStep,
      "type" | "summary"
    > & {
      type: "thought";
      summary?: Array<Content>;
    };

    // Narrowed from InteractionsNamespace.FunctionCallStep because
    // interactions-openapi.json uses `"const": "function_call"`, which sparktype outputs as `unknown`.
    export type FunctionCallStep = Omit<
      InteractionsNamespace.FunctionCallStep,
      "type"
    > & {
      type: "function_call";
    };

    // Narrowed from InteractionsNamespace.FunctionResultStep because
    // interactions-openapi.json uses `"const": "function_result"`, which sparktype outputs as `unknown`.
    export type FunctionResultStep = Omit<
      InteractionsNamespace.FunctionResultStep,
      "type" | "result"
    > & {
      type: "function_result";
      result: Array<Content> | string | Record<string, unknown>;
    };

    // Narrowed from InteractionsNamespace.CodeExecutionCallStep because
    // interactions-openapi.json uses `"const": "code_execution_call"`, which sparktype outputs as `unknown`.
    export type CodeExecutionCallStep = Omit<
      InteractionsNamespace.CodeExecutionCallStep,
      "type"
    > & {
      type: "code_execution_call";
    };

    // Narrowed from InteractionsNamespace.CodeExecutionResultStep because
    // interactions-openapi.json uses `"const": "code_execution_result"`, which sparktype outputs as `unknown`.
    export type CodeExecutionResultStep = Omit<
      InteractionsNamespace.CodeExecutionResultStep,
      "type"
    > & {
      type: "code_execution_result";
    };

    // Narrowed from InteractionsNamespace.GoogleSearchCallStep because
    // interactions-openapi.json uses `"const": "google_search_call"`, which sparktype outputs as `unknown`.
    export type GoogleSearchCallStep = Omit<
      InteractionsNamespace.GoogleSearchCallStep,
      "type"
    > & {
      type: "google_search_call";
    };

    // Narrowed from InteractionsNamespace.GoogleSearchResultStep because
    // interactions-openapi.json uses `"const": "google_search_result"`, which sparktype outputs as `unknown`.
    export type GoogleSearchResultStep = Omit<
      InteractionsNamespace.GoogleSearchResultStep,
      "type"
    > & {
      type: "google_search_result";
    };

    // Narrowed from InteractionsNamespace.UrlContextCallStep because
    // interactions-openapi.json uses `"const": "url_context_call"`, which sparktype outputs as `unknown`.
    export type UrlContextCallStep = Omit<
      InteractionsNamespace.UrlContextCallStep,
      "type"
    > & {
      type: "url_context_call";
    };

    // Narrowed from InteractionsNamespace.UrlContextResultStep because
    // interactions-openapi.json uses `"const": "url_context_result"`, which sparktype outputs as `unknown`.
    export type UrlContextResultStep = Omit<
      InteractionsNamespace.UrlContextResultStep,
      "type"
    > & {
      type: "url_context_result";
    };

    // Narrowed from InteractionsNamespace.FileSearchCallStep because
    // interactions-openapi.json uses `"const": "file_search_call"`, which sparktype outputs as `unknown`.
    export type FileSearchCallStep = Omit<
      InteractionsNamespace.FileSearchCallStep,
      "type"
    > & {
      type: "file_search_call";
    };

    // Narrowed from InteractionsNamespace.FileSearchResultStep because
    // interactions-openapi.json uses `"const": "file_search_result"`, which sparktype outputs as `unknown`.
    export type FileSearchResultStep = Omit<
      InteractionsNamespace.FileSearchResultStep,
      "type"
    > & {
      type: "file_search_result";
      result?: Array<FileSearchResultItem>;
    };

    // Narrowed from InteractionsNamespace.GoogleMapsCallStep because
    // interactions-openapi.json uses `"const": "google_maps_call"`, which sparktype outputs as `unknown`.
    export type GoogleMapsCallStep = Omit<
      InteractionsNamespace.GoogleMapsCallStep,
      "type"
    > & {
      type: "google_maps_call";
    };

    // Narrowed from InteractionsNamespace.GoogleMapsResultStep because
    // interactions-openapi.json uses `"const": "google_maps_result"`, which sparktype outputs as `unknown`.
    export type GoogleMapsResultStep = Omit<
      InteractionsNamespace.GoogleMapsResultStep,
      "type"
    > & {
      type: "google_maps_result";
    };

    // Narrowed from InteractionsNamespace.McpServerToolCallStep because
    // interactions-openapi.json uses `"const": "mcp_server_tool_call"`, which sparktype outputs as `unknown`.
    export type McpServerToolCallStep = Omit<
      InteractionsNamespace.McpServerToolCallStep,
      "type"
    > & {
      type: "mcp_server_tool_call";
    };

    // Narrowed from InteractionsNamespace.McpServerToolResultStep because
    // interactions-openapi.json uses `"const": "mcp_server_tool_result"`, which sparktype outputs as `unknown`.
    export type McpServerToolResultStep = Omit<
      InteractionsNamespace.McpServerToolResultStep,
      "type" | "result"
    > & {
      type: "mcp_server_tool_result";
      result: Array<Content> | string | Record<string, unknown>;
    };

    // Narrowed from InteractionsNamespace.ProcessingCallStep because
    // interactions-openapi.json uses `"const": "processing_call"`, which sparktype outputs as `unknown`.
    export type ProcessingCallStep = Omit<
      InteractionsNamespace.ProcessingCallStep,
      "type"
    > & {
      type: "processing_call";
    };

    // Narrowed from InteractionsNamespace.ProcessingResultStep because
    // interactions-openapi.json uses `"const": "processing_result"`, which sparktype outputs as `unknown`.
    export type ProcessingResultStep = Omit<
      InteractionsNamespace.ProcessingResultStep,
      "type"
    > & {
      type: "processing_result";
    };

    // Narrowed from InteractionsNamespace.RetrievalCallStep because
    // interactions-openapi.json uses `"const": "retrieval_call"`, which sparktype outputs as `unknown`.
    export type RetrievalCallStep = Omit<
      InteractionsNamespace.RetrievalCallStep,
      "type"
    > & {
      type: "retrieval_call";
    };

    // Narrowed from InteractionsNamespace.RetrievalResultStep because
    // interactions-openapi.json uses `"const": "retrieval_result"`, which sparktype outputs as `unknown`.
    export type RetrievalResultStep = Omit<
      InteractionsNamespace.RetrievalResultStep,
      "type"
    > & {
      type: "retrieval_result";
    };

    // Narrowed union of Step types with literal `type` discriminators.
    export type Step =
      | UserInputStep
      | ModelOutputStep
      | ThoughtStep
      | FunctionCallStep
      | FunctionResultStep
      | CodeExecutionCallStep
      | CodeExecutionResultStep
      | GoogleSearchCallStep
      | GoogleSearchResultStep
      | UrlContextCallStep
      | UrlContextResultStep
      | FileSearchCallStep
      | FileSearchResultStep
      | GoogleMapsCallStep
      | GoogleMapsResultStep
      | McpServerToolCallStep
      | McpServerToolResultStep
      | ProcessingCallStep
      | ProcessingResultStep
      | RetrievalCallStep
      | RetrievalResultStep;

    // =========================================================================
    // Narrowed Tool types
    // =========================================================================

    // Narrowed from InteractionsNamespace.Tools.Function because
    // interactions-openapi.json uses `"const": "function"`, which sparktype outputs as `unknown`.
    export type Function = Omit<InteractionsNamespace.Tools.Function, "type"> & {
      type: "function";
    };

    // Narrowed from InteractionsNamespace.Tools.GoogleSearch because
    // interactions-openapi.json uses `"const": "google_search"`, which sparktype outputs as `unknown`.
    export type GoogleSearch = Omit<
      InteractionsNamespace.Tools.GoogleSearch,
      "type"
    > & {
      type: "google_search";
      time_range_filter?: {
        start_time?: string;
        end_time?: string;
      };
    };

    // Narrowed from InteractionsNamespace.Tools.CodeExecution because
    // interactions-openapi.json uses `"const": "code_execution"`, which sparktype outputs as `unknown`.
    export type CodeExecution = Omit<
      InteractionsNamespace.Tools.CodeExecution,
      "type"
    > & {
      type: "code_execution";
    };

    // Narrowed from InteractionsNamespace.Tools.UrlContext because
    // interactions-openapi.json uses `"const": "url_context"`, which sparktype outputs as `unknown`.
    export type UrlContext = Omit<
      InteractionsNamespace.Tools.UrlContext,
      "type"
    > & {
      type: "url_context";
    };

    // Narrowed from InteractionsNamespace.Tools.ComputerUse because
    // interactions-openapi.json uses `"const": "computer_use"`, which sparktype outputs as `unknown`.
    export type ComputerUse = Omit<
      InteractionsNamespace.Tools.ComputerUse,
      "type"
    > & {
      type: "computer_use";
    };

    // Narrowed from InteractionsNamespace.Tools.FileSearch because
    // interactions-openapi.json uses `"const": "file_search"`, which sparktype outputs as `unknown`.
    export type FileSearch = Omit<
      InteractionsNamespace.Tools.FileSearch,
      "type"
    > & {
      type: "file_search";
    };

    // Narrowed from InteractionsNamespace.Tools.GoogleMaps because
    // interactions-openapi.json uses `"const": "google_maps"`, which sparktype outputs as `unknown`.
    export type GoogleMaps = Omit<
      InteractionsNamespace.Tools.GoogleMaps,
      "type"
    > & {
      type: "google_maps";
    };

    // Narrowed from InteractionsNamespace.Tools.McpServer because
    // interactions-openapi.json uses `"const": "mcp_server"`, which sparktype outputs as `unknown`.
    export type McpServer = Omit<
      InteractionsNamespace.Tools.McpServer,
      "type"
    > & {
      type: "mcp_server";
    };

    // Narrowed from InteractionsNamespace.Tools.Retrieval because
    // interactions-openapi.json uses `"const": "retrieval"`, which sparktype outputs as `unknown`.
    export type Retrieval = Omit<
      InteractionsNamespace.Tools.Retrieval,
      "type"
    > & {
      type: "retrieval";
    };

    // Narrowed union of Tool types with literal `type` discriminators.
    export type Tool =
      | Function
      | GoogleSearch
      | CodeExecution
      | UrlContext
      | ComputerUse
      | FileSearch
      | GoogleMaps
      | McpServer
      | Retrieval;

    export namespace Tools {
      export type AllowedTools = InteractionsNamespace.Tools.AllowedTools;
      export type CodeExecution = Gemini.Interactions.CodeExecution;
      export type ComputerUse = Gemini.Interactions.ComputerUse;
      export type FileSearch = Gemini.Interactions.FileSearch;
      export type Function = Gemini.Interactions.Function;
      export type GoogleMaps = Gemini.Interactions.GoogleMaps;
      export type GoogleSearch = Gemini.Interactions.GoogleSearch;
      export type McpServer = Gemini.Interactions.McpServer;
      export type Retrieval = Gemini.Interactions.Retrieval;
      export type Tool = Gemini.Interactions.Tool;
      export type UrlContext = Gemini.Interactions.UrlContext;
      export type VertexAISearchConfig =
        InteractionsNamespace.Tools.VertexAISearchConfig;
    }

    // =========================================================================
    // Narrowed ResponseFormat types
    // =========================================================================

    // Narrowed from InteractionsNamespace.TextResponseFormat because
    // interactions-openapi.json uses `"const": "text"`, which sparktype outputs as `unknown`.
    export type TextResponseFormat = Omit<
      InteractionsNamespace.TextResponseFormat,
      "type"
    > & {
      type: "text";
    };

    // Narrowed from InteractionsNamespace.ImageResponseFormat because
    // interactions-openapi.json uses `"const": "image"`, which sparktype outputs as `unknown`.
    export type ImageResponseFormat = Omit<
      InteractionsNamespace.ImageResponseFormat,
      "type"
    > & {
      type: "image";
    };

    // Narrowed from InteractionsNamespace.AudioResponseFormat because
    // interactions-openapi.json uses `"const": "audio"`, which sparktype outputs as `unknown`.
    export type AudioResponseFormat = Omit<
      InteractionsNamespace.AudioResponseFormat,
      "type"
    > & {
      type: "audio";
    };

    // Narrowed from InteractionsNamespace.VideoResponseFormat because
    // interactions-openapi.json uses `"const": "video"`, which sparktype outputs as `unknown`.
    export type VideoResponseFormat = Omit<
      InteractionsNamespace.VideoResponseFormat,
      "type"
    > & {
      type: "video";
      mime_type?: string;
    };

    // Narrowed union of ResponseFormat types with literal `type` discriminators.
    export type ResponseFormat =
      | TextResponseFormat
      | ImageResponseFormat
      | AudioResponseFormat
      | VideoResponseFormat;

    // =========================================================================
    // Narrowed AgentConfig types
    // =========================================================================

    // Narrowed from InteractionsNamespace.AntigravityAgentConfig because
    // interactions-openapi.json uses `"const": "antigravity"`, which sparktype outputs as `unknown`.
    export type AntigravityAgentConfig = Omit<
      InteractionsNamespace.AntigravityAgentConfig,
      "type"
    > & {
      type: "antigravity";
    };

    // Narrowed from InteractionsNamespace.CodeMenderAgentConfig because
    // interactions-openapi.json uses `"const": "code-mender"`, which sparktype outputs as `unknown`.
    export type CodeMenderAgentConfig = Omit<
      InteractionsNamespace.CodeMenderAgentConfig,
      "type"
    > & {
      type: "code-mender";
    };

    // Narrowed from InteractionsNamespace.DeepResearchAgentConfig because
    // interactions-openapi.json uses `"const": "deep-research"`, which sparktype outputs as `unknown`.
    export type DeepResearchAgentConfig = Omit<
      InteractionsNamespace.DeepResearchAgentConfig,
      "type"
    > & {
      type: "deep-research";
    };

    // Narrowed from InteractionsNamespace.DynamicAgentConfig because
    // interactions-openapi.json uses `"const": "dynamic"`, which sparktype outputs as `unknown`.
    export type DynamicAgentConfig = Omit<
      InteractionsNamespace.DynamicAgentConfig,
      "type"
    > & {
      type: "dynamic";
    };

    // Narrowed union of AgentConfig types with literal `type` discriminators.
    export type AgentConfig =
      | AntigravityAgentConfig
      | CodeMenderAgentConfig
      | DeepResearchAgentConfig
      | DynamicAgentConfig;

    // =========================================================================
    // Narrowed Top-Level Request & Response Container types
    // =========================================================================

    // Request parameters for creating an Interaction (`POST /v1beta/interactions`).
    // Combines the writable request fields from Interaction
    // with narrowed `input`, `tools`, `response_format`, `generation_config`, and `agent_config` unions.
    export type CreateInteractionParameters = Omit<
      InteractionsNamespace.Interaction,
      | "agent_config"
      | "created"
      | "environment_id"
      | "errors"
      | "generation_config"
      | "id"
      | "input"
      | "model"
      | "response_format"
      | "status"
      | "steps"
      | "tools"
      | "updated"
      | "usage"
    > & {
      model?: InteractionsNamespace.ModelOption;
      agent?: InteractionsNamespace.AgentOption;
      agent_config?: AgentConfig;
      generation_config?: GenerationConfig;
      input: Array<Content> | Array<Step> | Content | Step | string;
      response_format?:
        | Record<string, unknown>
        | ResponseFormat
        | Array<ResponseFormat>;
      tools?: Array<Tool>;
    };

    // Narrowed from InteractionsNamespace.Interaction so nested
    // `steps`, `input`, `tools`, `response_format`, `generation_config`, and `agent_config` use the narrowed
    // discriminator unions above. Also includes optional legacy `outputs` and `role` fields.
    export type Interaction = Omit<
      InteractionsNamespace.Interaction,
      | "agent_config"
      | "generation_config"
      | "input"
      | "model"
      | "response_format"
      | "steps"
      | "tools"
    > & {
      model?: InteractionsNamespace.ModelOption;
      agent?: InteractionsNamespace.AgentOption;
      agent_config?: AgentConfig;
      generation_config?: GenerationConfig;
      input?: Array<Content> | Array<Step> | Content | Step | string;
      response_format?:
        | Record<string, unknown>
        | ResponseFormat
        | Array<ResponseFormat>;
      role?: string;
      steps?: Array<Step>;
      outputs?: Array<Step | Content>;
      tools?: Array<Tool>;
    };

    // =========================================================================
    // Re-exported non-discriminated types from `./api_types/interactions.ts`
    // =========================================================================
    export type AllowedTools = InteractionsNamespace.Tools.AllowedTools;
    export type CodeExecutionCallStepArguments =
      InteractionsNamespace.CodeExecutionCallStepArguments;
    export type Error = InteractionsNamespace.Status;
    export type Status = InteractionsNamespace.Status;
    export interface FileSearchResultItem {
      title?: string;
      text?: string;
      file_search_store?: string;
    }
    export type GenerationConfig = Omit<
      InteractionsNamespace.GenerationConfig,
      "image_config"
    > & {
      top_k?: number;
      presence_penalty?: number;
      frequency_penalty?: number;
      response_logprobs?: boolean;
      logprobs?: number;
      image_config?: InteractionsNamespace.ImageConfig & {
        type?: "image";
      };
    };
    export type GoogleMapsCallStepArguments =
      InteractionsNamespace.GoogleMapsCallStepArguments;
    export type GoogleMapsCallArguments =
      InteractionsNamespace.GoogleMapsCallStepArguments;
    export type GoogleMapsResultItem =
      InteractionsNamespace.GoogleMapsResultItem;
    export type GoogleMapsResult = InteractionsNamespace.GoogleMapsResultItem;
    export type GoogleMapsResultPlaces =
      InteractionsNamespace.GoogleMapsResultPlaces;
    export type GoogleSearchCallStepArguments =
      InteractionsNamespace.GoogleSearchCallStepArguments;
    export type GoogleSearchResultItem =
      InteractionsNamespace.GoogleSearchResultItem;
    export type HarmCategory = InteractionsNamespace.HarmCategory;
    export type MediaResolution = InteractionsNamespace.MediaResolution;
    export type ModalityTokens = InteractionsNamespace.ModalityTokens;
    export type Model = InteractionsNamespace.ModelOption;
    export type ModelOption = InteractionsNamespace.ModelOption;
    export type ResponseModality = InteractionsNamespace.ResponseModality;
    export type ReviewSnippet = InteractionsNamespace.ReviewSnippet;
    export type PlaceCitationReviewSnippet =
      InteractionsNamespace.ReviewSnippet;
    export type RetrievalStepArguments =
      InteractionsNamespace.RetrievalStepArguments;
    export type RetrievalCallArguments =
      InteractionsNamespace.RetrievalStepArguments;
    export type SafetySetting = InteractionsNamespace.SafetySetting;
    export type ServiceTier = InteractionsNamespace.ServiceTier;
    export type SpeakerConfig = InteractionsNamespace.SpeakerConfig;
    export type SpeechConfig = InteractionsNamespace.SpeechConfig;
    export type ThinkingLevel = InteractionsNamespace.ThinkingLevel;
    export type ToolChoiceType =
      | "auto"
      | "any"
      | "none"
      | "validated"
      | (string & {});
    export type ToolChoiceConfig = InteractionsNamespace.ToolChoiceConfig;
    export type ToolChoice = ToolChoiceType | ToolChoiceConfig;
    export type UrlContextCallStepArguments =
      InteractionsNamespace.UrlContextCallArguments;
    export type UrlContextCallArguments =
      InteractionsNamespace.UrlContextCallArguments;
    export type UrlContextResultItem = InteractionsNamespace.UrlContextResult;
    export type UrlContextResult = InteractionsNamespace.UrlContextResult;
    export type Usage = InteractionsNamespace.Usage;
    export type VertexAISearchConfig =
      InteractionsNamespace.Tools.VertexAISearchConfig;
    export type VertexAiSearchConfig =
      InteractionsNamespace.Tools.VertexAISearchConfig;
    export type WebhookConfig = InteractionsNamespace.WebhookConfig;

    // =========================================================================
    // SSE Stream Event & Delta types from `interactions-openapi.json`
    // Note: sparktype did not emit the SSE `text/event-stream` response union
    // schemas into `./api_types/interactions.ts`, so we define them here with
    // narrowed discriminator literals (supporting both OpenAPI `step.*` /
    // `interaction.created` / `interaction.completed` and legacy `content.*` /
    // `interaction.start` / `interaction.complete` aliases).
    // =========================================================================

    export type InteractionSseEventInteraction = Omit<
      Interaction,
      "steps" | "outputs"
    > & {
      steps?: Array<Step>;
      outputs?: Array<Step | Content>;
    };

    export interface TextDelta {
      type: "text";
      text: string;
    }

    export interface TextAnnotationDelta {
      type: "text_annotation_delta" | "text_annotation";
      annotations?: Array<Annotation>;
    }

    export interface ImageDelta {
      type: "image";
      data?: string;
      mime_type?: ImageContent["mime_type"];
      resolution?: MediaResolution;
      uri?: string;
    }

    export interface AudioDelta {
      type: "audio";
      channels?: number;
      data?: string;
      mime_type?: AudioContent["mime_type"];
      rate?: number;
      sample_rate?: number;
      uri?: string;
    }

    export interface DocumentDelta {
      type: "document";
      data?: string;
      mime_type?: DocumentContent["mime_type"];
      uri?: string;
    }

    export interface VideoDelta {
      type: "video";
      data?: string;
      mime_type?: VideoContent["mime_type"];
      resolution?: MediaResolution;
      uri?: string;
    }

    export interface ThoughtSummaryDelta {
      type: "thought_summary";
      content?: Content;
    }

    export interface ThoughtSignatureDelta {
      type: "thought_signature";
      signature?: string;
    }

    export interface ArgumentsDelta {
      type: "arguments_delta" | "function_call";
      id?: string;
      name?: string;
      arguments?: string | Record<string, unknown>;
    }

    export interface CodeExecutionCallDelta {
      type: "code_execution_call";
      id?: string;
      arguments?: CodeExecutionCallStepArguments;
      signature?: string;
    }

    export interface CodeExecutionResultDelta {
      type: "code_execution_result";
      call_id?: string;
      is_error?: boolean;
      result?: string;
      signature?: string;
    }

    export interface GoogleSearchCallDelta {
      type: "google_search_call";
      id?: string;
      arguments?: GoogleSearchCallStepArguments;
      signature?: string;
    }

    export interface GoogleSearchResultDelta {
      type: "google_search_result";
      call_id?: string;
      is_error?: boolean;
      result?: Array<
        GoogleSearchResultItem & {
          title?: string;
          url?: string;
          rendered_content?: string;
        }
      >;
      signature?: string;
    }

    export interface UrlContextCallDelta {
      type: "url_context_call";
      id?: string;
      arguments?: UrlContextCallArguments;
      signature?: string;
    }

    export interface UrlContextResultDelta {
      type: "url_context_result";
      call_id?: string;
      is_error?: boolean;
      result?: Array<UrlContextResult>;
      signature?: string;
    }

    export interface FileSearchCallDelta {
      type: "file_search_call";
      id?: string;
      signature?: string;
    }

    export interface FileSearchResultDelta {
      type: "file_search_result";
      call_id?: string;
      result?: Array<FileSearchResultItem>;
      signature?: string;
    }

    export interface GoogleMapsCallDelta {
      type: "google_maps_call";
      id?: string;
      arguments?: GoogleMapsCallArguments;
      signature?: string;
    }

    export interface GoogleMapsResultDelta {
      type: "google_maps_result";
      call_id?: string;
      result?: Array<GoogleMapsResult>;
      signature?: string;
    }

    export interface McpServerToolCallDelta {
      type: "mcp_server_tool_call";
      id?: string;
      name?: string;
      server_name?: string;
      arguments?: string | Record<string, unknown>;
      signature?: string;
    }

    export interface McpServerToolResultDelta {
      type: "mcp_server_tool_result";
      call_id?: string;
      name?: string;
      server_name?: string;
      result?: Array<Content> | string | Record<string, unknown>;
      signature?: string;
    }

    export interface ProcessingCallDelta {
      type: "processing_call";
      id?: string;
      signature?: string;
    }

    export interface ProcessingResultDelta {
      type: "processing_result";
      call_id?: string;
      signature?: string;
    }

    export interface RetrievalCallDelta {
      type: "retrieval_call";
      id?: string;
      arguments?: RetrievalCallArguments;
      retrieval_type?: RetrievalCallStep["retrieval_type"];
      signature?: string;
    }

    export interface RetrievalResultDelta {
      type: "retrieval_result";
      call_id?: string;
      is_error?: boolean;
      signature?: string;
    }

    export type StepDeltaData =
      | TextDelta
      | TextAnnotationDelta
      | ImageDelta
      | AudioDelta
      | DocumentDelta
      | VideoDelta
      | ThoughtSummaryDelta
      | ThoughtSignatureDelta
      | ArgumentsDelta
      | CodeExecutionCallDelta
      | CodeExecutionResultDelta
      | GoogleSearchCallDelta
      | GoogleSearchResultDelta
      | UrlContextCallDelta
      | UrlContextResultDelta
      | FileSearchCallDelta
      | FileSearchResultDelta
      | GoogleMapsCallDelta
      | GoogleMapsResultDelta
      | McpServerToolCallDelta
      | McpServerToolResultDelta
      | ProcessingCallDelta
      | ProcessingResultDelta
      | RetrievalCallDelta
      | RetrievalResultDelta;

    export interface InteractionCreatedEvent {
      event_id?: string;
      event_type: "interaction.created" | "interaction.start";
      interaction: InteractionSseEventInteraction;
    }

    export interface InteractionCompletedEvent {
      event_id?: string;
      event_type: "interaction.completed" | "interaction.complete";
      interaction: InteractionSseEventInteraction;
    }

    export interface InteractionStatusUpdate {
      continuation_token?: string;
      event_id?: string;
      event_type: "interaction.status_update";
      interaction_id: string;
      status: Interaction["status"];
      usage?: Usage;
    }

    export interface StepStart {
      event_id?: string;
      event_type: "step.start" | "content.start";
      index: number;
      step?: Step;
      content?: Step | Content;
    }

    export interface StepDelta {
      delta: StepDeltaData;
      event_id?: string;
      event_type: "step.delta" | "content.delta";
      index: number;
      metadata?: {
        total_usage?: Usage;
      };
    }

    export interface StepStop {
      event_id?: string;
      event_type: "step.stop" | "content.stop";
      index: number;
      step_usage?: Usage;
      usage?: Usage;
    }

    export interface ErrorEvent {
      error?: Error;
      event_id?: string;
      event_type: "error";
    }

    export type InteractionSseEvent =
      | InteractionCreatedEvent
      | InteractionCompletedEvent
      | InteractionStatusUpdate
      | StepStart
      | StepDelta
      | StepStop
      | ErrorEvent;
  }
}

export type {
  GenContentNamespace as GenContent,
  InteractionsNamespace as Interactions,
};

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
