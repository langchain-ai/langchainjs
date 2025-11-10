// https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference#request

import type { InteropZodType } from "@langchain/core/utils/types";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";

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
  safetySettings?: GoogleSafetySetting[];

  /**
   * Configuration for the model's thinking process
   */
  thinkingConfig?: GoogleThinkingConfig;

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
  responseModalities?: ("TEXT" | "IMAGE" | "AUDIO")[];

  /**
   * If true, enables enhanced civic answers feature.
   */
  enableEnhancedCivicAnswers?: boolean;

  /**
   * Configuration for speech generation.
   */
  speechConfig?: GoogleSpeechConfig;

  /**
   * Configuration for image generation.
   */
  imageConfig?: GoogleImageConfig;

  /**
   * Media resolution for input media processing.
   */
  mediaResolution?: GoogleMediaResolution;
}

export interface GoogleSafetySetting {
  /**
   * The safety category to configure a threshold for.
   */
  category?: GoogleHarmCategory;

  /**
   * The threshold for blocking responses that could belong to the specified
   * safety category based on probability.
   */
  threshold?: GoogleHarmBlockThreshold;

  /**
   * Specify if the threshold is used for probability or severity score. If not
   * specified, the threshold is used for probability score.
   */
  method?: GoogleHarmBlockMethod;
}

/** Harm categories that block content */
export type GoogleHarmCategory =
  | "HARM_CATEGORY_UNSPECIFIED"
  | "HARM_CATEGORY_HATE_SPEECH"
  | "HARM_CATEGORY_DANGEROUS_CONTENT"
  | "HARM_CATEGORY_HARASSMENT"
  | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
  | "HARM_CATEGORY_CIVIC_INTEGRITY";

/** Probability thresholds levels used to block a response. */
export type GoogleHarmBlockThreshold =
  | "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
  | "BLOCK_LOW_AND_ABOVE"
  | "BLOCK_MEDIUM_AND_ABOVE"
  | "BLOCK_ONLY_HIGH"
  | "BLOCK_NONE"
  | "OFF";

/**
 * A probability threshold that blocks a response based on a combination of
 * probability and severity.
 */
export type GoogleHarmBlockMethod =
  | "HARM_BLOCK_METHOD_UNSPECIFIED"
  | "SEVERITY"
  | "PROBABILITY";

/** Configuration for the model's thinking process */
export interface GoogleThinkingConfig {
  /**
   * The maximum number of tokens that can be used for the
   * thinking/reasoning stages.
   */
  thinkingBudget?: number;
}

/** Modality types for response generation */
export type GoogleModality =
  | "TEXT"
  | "IMAGE"
  | "AUDIO"
  | "MODALITY_UNSPECIFIED";

/** Media resolution for input media processing */
export type GoogleMediaResolution =
  | "MEDIA_RESOLUTION_UNSPECIFIED"
  | "MEDIA_RESOLUTION_LOW"
  | "MEDIA_RESOLUTION_MEDIUM"
  | "MEDIA_RESOLUTION_HIGH";

/** Configuration for speech generation */
export interface GoogleSpeechConfig {
  /**
   * The configuration for single-voice output.
   * Mutually exclusive with multiSpeakerVoiceConfig.
   */
  voiceConfig?: GoogleVoiceConfig;

  /**
   * The configuration for multi-speaker setup.
   * Mutually exclusive with voiceConfig.
   */
  multiSpeakerVoiceConfig?: GoogleMultiSpeakerVoiceConfig;

  /**
   * Language code (in BCP 47 format, e.g. "en-US") for speech synthesis.
   */
  languageCode?: string;
}

/** Configuration for a voice to use */
export interface GoogleVoiceConfig {
  /**
   * The configuration for the prebuilt voice to use.
   */
  prebuiltVoiceConfig?: GooglePrebuiltVoiceConfig;
}

/** Configuration for a prebuilt voice */
export interface GooglePrebuiltVoiceConfig {
  /**
   * The name of the preset voice to use.
   */
  voiceName?: string;
}

/** Configuration for multi-speaker voice setup */
export interface GoogleMultiSpeakerVoiceConfig {
  /**
   * All the enabled speaker voices.
   */
  speakerVoiceConfigs: GoogleSpeakerVoiceConfig[];
}

/** Configuration for a single speaker in multi-speaker setup */
export interface GoogleSpeakerVoiceConfig {
  /**
   * The name of the speaker to use. Should be the same as in the prompt.
   */
  speaker: string;

  /**
   * The configuration for the voice to use.
   */
  voiceConfig: GoogleVoiceConfig;
}

/** Configuration for image generation */
export interface GoogleImageConfig {
  /**
   * The aspect ratio of the image to generate.
   * Supported aspect ratios: 1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, 21:9.
   */
  aspectRatio?: string;
}

// Gemini API Types based on https://ai.google.dev/api/generate-content
// TODO(hntrl): automate fetching these from OpenAPI spec
// https://generativelanguage.googleapis.com/$discovery/OPENAPI3_0?version=v1beta&key=

export type GeminiRole = "user" | "model" | "function";

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 encoded
  };
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
  executableCode?: {
    language: string;
    code: string;
  };
  codeExecutionResult?: {
    outcome: string;
    output: string;
  };
}

export interface GeminiContent {
  role: GeminiRole;
  parts: GeminiPart[];
}

export interface GeminiSystemInstruction {
  parts: GeminiPart[];
}

export interface GeminiGenerationConfig {
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: unknown;
  responseJsonSchema?: unknown;
  responseModalities?: string[];
  candidateCount?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  seed?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseLogprobs?: boolean;
  logprobs?: number;
  enableEnhancedCivicAnswers?: boolean;
  thinkingConfig?: GoogleThinkingConfig;
  speechConfig?: GoogleSpeechConfig;
  imageConfig?: GoogleImageConfig;
  mediaResolution?: GoogleMediaResolution;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: GeminiFunctionSchema;
}

export interface GeminiFunctionSchema {
  type?: string;
  properties?: Record<string, GeminiFunctionSchema>;
  required?: string[];
  items?: GeminiFunctionSchema;
  enum?: unknown[];
  nullable?: boolean;
  [key: string]: unknown;
}

export interface GeminiTool {
  functionDeclarations?: GeminiFunctionDeclaration[];
  codeExecution?: Record<string, unknown>;
  googleSearchRetrieval?: Record<string, unknown>;
}

export interface GenerateContentRequest {
  contents: GeminiContent[];
  tools?: GeminiTool[];
  toolConfig?: {
    functionCallingConfig?: {
      mode?: "AUTO" | "ANY" | "NONE";
    };
  };
  safetySettings?: GoogleSafetySetting[];
  systemInstruction?: GeminiSystemInstruction;
  generationConfig?: GeminiGenerationConfig;
  cachedContent?: string;
}

export type GeminiFinishReason =
  | "FINISH_REASON_UNSPECIFIED"
  | "STOP"
  | "MAX_TOKENS"
  | "SAFETY"
  | "RECITATION"
  | "LANGUAGE"
  | "OTHER"
  | "BLOCKLIST"
  | "PROHIBITED_CONTENT"
  | "SPII"
  | "MALFORMED_FUNCTION_CALL"
  | "IMAGE_SAFETY"
  | "IMAGE_PROHIBITED_CONTENT"
  | "IMAGE_OTHER"
  | "NO_IMAGE"
  | "IMAGE_RECITATION"
  | "UNEXPECTED_TOOL_CALL"
  | "TOO_MANY_TOOL_CALLS";

export interface GeminiSafetyRating {
  category: GoogleHarmCategory;
  probability: string;
  blocked?: boolean;
}

export interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: GeminiFinishReason;
  finishMessage?: string;
  safetyRatings?: GeminiSafetyRating[];
  citationMetadata?: {
    citationSources?: Array<{
      startIndex?: number;
      endIndex?: number;
      uri?: string;
      license?: string;
    }>;
  };
  tokenCount?: number;
  index?: number;
}

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
  toolUsePromptTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface GeminiPromptFeedback {
  blockReason?: string;
  safetyRatings?: GeminiSafetyRating[];
}

export interface GenerateContentResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
  responseId?: string;
}
