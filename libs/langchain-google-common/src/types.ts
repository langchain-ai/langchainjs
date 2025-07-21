import type { BaseLLMParams } from "@langchain/core/language_models/llms";
import type {
  BaseChatModelCallOptions,
  BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import {
  BaseMessage,
  BaseMessageChunk,
  MessageContent,
} from "@langchain/core/messages";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { EmbeddingsParams } from "@langchain/core/embeddings";
import { AsyncCallerCallOptions } from "@langchain/core/utils/async_caller";
import type { JsonStream } from "./utils/stream.js";
import { MediaManager } from "./experimental/utils/media_core.js";
import {
  AnthropicResponseData,
  AnthropicAPIConfig,
} from "./types-anthropic.js";

export * from "./types-anthropic.js";

/**
 * Parameters needed to setup the client connection.
 * AuthOptions are something like GoogleAuthOptions (from google-auth-library)
 * or WebGoogleAuthOptions.
 */
export interface GoogleClientParams<AuthOptions> {
  authOptions?: AuthOptions;

  /** Some APIs allow an API key instead */
  apiKey?: string;
}

/**
 * What platform is this running on?
 * gai - Google AI Studio / MakerSuite / Generative AI platform
 * gcp - Google Cloud Platform
 */
export type GooglePlatformType = "gai" | "gcp";

export interface GoogleConnectionParams<AuthOptions>
  extends GoogleClientParams<AuthOptions> {
  /** Hostname for the API call (if this is running on GCP) */
  endpoint?: string;

  /** Region where the LLM is stored (if this is running on GCP) */
  location?: string;

  /** The version of the API functions. Part of the path. */
  apiVersion?: string;

  /**
   * What platform to run the service on.
   * If not specified, the class should determine this from other
   * means. Either way, the platform actually used will be in
   * the "platform" getter.
   */
  platformType?: GooglePlatformType;

  /**
   * For compatibility with Google's libraries, should this use Vertex?
   * The "platformType" parmeter takes precedence.
   */
  vertexai?: boolean;
}

export const GoogleAISafetyCategory = {
  Harassment: "HARM_CATEGORY_HARASSMENT",
  HARASSMENT: "HARM_CATEGORY_HARASSMENT",
  HARM_CATEGORY_HARASSMENT: "HARM_CATEGORY_HARASSMENT",

  HateSpeech: "HARM_CATEGORY_HATE_SPEECH",
  HATE_SPEECH: "HARM_CATEGORY_HATE_SPEECH",
  HARM_CATEGORY_HATE_SPEECH: "HARM_CATEGORY_HATE_SPEECH",

  SexuallyExplicit: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  SEXUALLY_EXPLICIT: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  HARM_CATEGORY_SEXUALLY_EXPLICIT: "HARM_CATEGORY_SEXUALLY_EXPLICIT",

  Dangerous: "HARM_CATEGORY_DANGEROUS",
  DANGEROUS: "HARM_CATEGORY_DANGEROUS",
  HARM_CATEGORY_DANGEROUS: "HARM_CATEGORY_DANGEROUS",

  CivicIntegrity: "HARM_CATEGORY_CIVIC_INTEGRITY",
  CIVIC_INTEGRITY: "HARM_CATEGORY_CIVIC_INTEGRITY",
  HARM_CATEGORY_CIVIC_INTEGRITY: "HARM_CATEGORY_CIVIC_INTEGRITY",
} as const;

export type GoogleAISafetyCategory =
  (typeof GoogleAISafetyCategory)[keyof typeof GoogleAISafetyCategory];

export const GoogleAISafetyThreshold = {
  None: "BLOCK_NONE",
  NONE: "BLOCK_NONE",
  BLOCK_NONE: "BLOCK_NONE",

  Few: "BLOCK_ONLY_HIGH",
  FEW: "BLOCK_ONLY_HIGH",
  BLOCK_ONLY_HIGH: "BLOCK_ONLY_HIGH",

  Some: "BLOCK_MEDIUM_AND_ABOVE",
  SOME: "BLOCK_MEDIUM_AND_ABOVE",
  BLOCK_MEDIUM_AND_ABOVE: "BLOCK_MEDIUM_AND_ABOVE",

  Most: "BLOCK_LOW_AND_ABOVE",
  MOST: "BLOCK_LOW_AND_ABOVE",
  BLOCK_LOW_AND_ABOVE: "BLOCK_LOW_AND_ABOVE",

  Off: "OFF",
  OFF: "OFF",
  BLOCK_OFF: "OFF",
} as const;

export type GoogleAISafetyThreshold =
  (typeof GoogleAISafetyThreshold)[keyof typeof GoogleAISafetyThreshold];

export const GoogleAISafetyMethod = {
  Severity: "SEVERITY",
  Probability: "PROBABILITY",
} as const;

export type GoogleAISafetyMethod =
  (typeof GoogleAISafetyMethod)[keyof typeof GoogleAISafetyMethod];

export interface GoogleAISafetySetting {
  category: GoogleAISafetyCategory | string;
  threshold: GoogleAISafetyThreshold | string;
  method?: GoogleAISafetyMethod | string; // Just for Vertex AI?
}

export type GoogleAIResponseMimeType = "text/plain" | "application/json";

export type GoogleAIModelModality = "TEXT" | "IMAGE" | "AUDIO" | string;

export interface GoogleThinkingConfig {
  thinkingBudget?: number;
  includeThoughts?: boolean;
}

export type GooglePrebuiltVoiceName = string;

export interface GooglePrebuiltVoiceConfig {
  voiceName: GooglePrebuiltVoiceName;
}

export interface GoogleVoiceConfig {
  prebuiltVoiceConfig: GooglePrebuiltVoiceConfig;
}

export interface GoogleSpeakerVoiceConfig {
  speaker: string;
  voiceConfig: GoogleVoiceConfig;
}

export interface GoogleMultiSpeakerVoiceConfig {
  speakerVoiceConfigs: GoogleSpeakerVoiceConfig[];
}

export interface GoogleSpeechConfigSingle {
  voiceConfig: GoogleVoiceConfig;
  languageCode?: string;
}

export interface GoogleSpeechConfigMulti {
  multiSpeakerVoiceConfig: GoogleMultiSpeakerVoiceConfig;
  languageCode?: string;
}

export type GoogleSpeechConfig =
  | GoogleSpeechConfigSingle
  | GoogleSpeechConfigMulti;

/**
 * A simplified version of the GoogleSpeakerVoiceConfig
 */
export interface GoogleSpeechSpeakerName {
  speaker: string;
  name: GooglePrebuiltVoiceName;
}

export type GoogleSpeechVoice =
  | GooglePrebuiltVoiceName
  | GoogleSpeechSpeakerName
  | GoogleSpeechSpeakerName[];

export interface GoogleSpeechVoiceLanguage {
  voice: GoogleSpeechVoice;
  languageCode: string;
}

export interface GoogleSpeechVoicesLanguage {
  voices: GoogleSpeechVoice;
  languageCode: string;
}

/**
 * A simplified way to represent the voice (or voices) and language code.
 * "voice" and "voices" are semantically the same, we're not enforcing
 * that one is an array and one isn't.
 */
export type GoogleSpeechSimplifiedLanguage =
  | GoogleSpeechVoiceLanguage
  | GoogleSpeechVoicesLanguage;

/**
 * A simplified way to represent the voices.
 * It can either be the voice (or voices), or the voice or voices with language configuration
 */
export type GoogleSpeechConfigSimplified =
  | GoogleSpeechVoice
  | GoogleSpeechSimplifiedLanguage;

export interface GoogleModelParams {
  /** Model to use */
  model?: string;

  /**
   * Model to use
   * Alias for `model`
   */
  modelName?: string;
}

export interface GoogleAIModelParams extends GoogleModelParams {
  /** Sampling temperature to use */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   * This may include reasoning tokens (for backwards compatibility).
   */
  maxOutputTokens?: number;

  /**
   * The maximum number of the output tokens that will be used
   * for the "thinking" or "reasoning" stages.
   */
  maxReasoningTokens?: number;

  /**
   * An alias for "maxReasoningTokens"
   */
  thinkingBudget?: number;

  /**
   * An OpenAI compatible parameter that will map to "maxReasoningTokens"
   */
  reasoningEffort?: "low" | "medium" | "high";

  /**
   * Top-p changes how the model selects tokens for output.
   *
   * Tokens are selected from most probable to least until the sum
   * of their probabilities equals the top-p value.
   *
   * For example, if tokens A, B, and C have a probability of
   * .3, .2, and .1 and the top-p value is .5, then the model will
   * select either A or B as the next token (using temperature).
   */
  topP?: number;

  /**
   * Top-k changes how the model selects tokens for output.
   *
   * A top-k of 1 means the selected token is the most probable among
   * all tokens in the model’s vocabulary (also called greedy decoding),
   * while a top-k of 3 means that the next token is selected from
   * among the 3 most probable tokens (using temperature).
   */
  topK?: number;

  /**
   * Seed used in decoding. If not set, the request uses a randomly generated seed.
   */
  seed?: number;

  /**
   * Presence penalty applied to the next token's logprobs
   * if the token has already been seen in the response.
   * This penalty is binary on/off and not dependant on the
   * number of times the token is used (after the first).
   * Use frequencyPenalty for a penalty that increases with each use.
   * A positive penalty will discourage the use of tokens that have
   * already been used in the response, increasing the vocabulary.
   * A negative penalty will encourage the use of tokens that have
   * already been used in the response, decreasing the vocabulary.
   */
  presencePenalty?: number;

  /**
   * Frequency penalty applied to the next token's logprobs,
   * multiplied by the number of times each token has been seen
   * in the respponse so far.
   * A positive penalty will discourage the use of tokens that
   * have already been used, proportional to the number of times
   * the token has been used:
   * The more a token is used, the more dificult it is for the model
   * to use that token again increasing the vocabulary of responses.
   * Caution: A _negative_ penalty will encourage the model to reuse
   * tokens proportional to the number of times the token has been used.
   * Small negative values will reduce the vocabulary of a response.
   * Larger negative values will cause the model to start repeating
   * a common token until it hits the maxOutputTokens limit.
   */
  frequencyPenalty?: number;

  stopSequences?: string[];

  safetySettings?: GoogleAISafetySetting[];

  convertSystemMessageToHumanContent?: boolean;

  /**
   * Available for `gemini-1.5-pro`.
   * The output format of the generated candidate text.
   * Supported MIME types:
   *  - `text/plain`: Text output.
   *  - `application/json`: JSON response in the candidates.
   *
   * @default "text/plain"
   */
  responseMimeType?: GoogleAIResponseMimeType;

  /**
   * Whether or not to stream.
   * @default false
   */
  streaming?: boolean;

  /**
   * Whether to return log probabilities of the output tokens or not.
   * If true, returns the log probabilities of each output token
   * returned in the content of message.
   */
  logprobs?: boolean;

  /**
   * An integer between 0 and 5 specifying the number of
   * most likely tokens to return at each token position,
   * each with an associated log probability.
   * logprobs must be set to true if this parameter is used.
   */
  topLogprobs?: number;

  /**
   * The modalities of the response.
   */
  responseModalities?: GoogleAIModelModality[];

  /**
   * Custom metadata labels to associate with the request.
   * Only supported on Vertex AI (Google Cloud Platform).
   * Labels are key-value pairs where both keys and values must be strings.
   *
   * Example:
   * ```typescript
   * {
   *   labels: {
   *     "team": "research",
   *     "component": "frontend",
   *     "environment": "production"
   *   }
   * }
   * ```
   */
  labels?: Record<string, string>;

  /**
   * Speech generation configuration.
   * You can use either Google's definition of the speech configuration,
   * or a simplified version we've defined (which can be as simple
   * as the name of a pre-defined voice).
   */
  speechConfig?: GoogleSpeechConfig | GoogleSpeechConfigSimplified;
}

export type GoogleAIToolType = BindToolsInput | GeminiTool;

/**
 * The params which can be passed to the API at request time.
 */
export interface GoogleAIModelRequestParams extends GoogleAIModelParams {
  tools?: GoogleAIToolType[];
  /**
   * Force the model to use tools in a specific way.
   *
   * | Mode     |	Description                                                                                                                                             |
   * |----------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
   * | "auto"	  | The default model behavior. The model decides whether to predict a function call or a natural language response.                                        |
   * | "any"	  | The model must predict only function calls. To limit the model to a subset of functions, define the allowed function names in `allowed_function_names`. |
   * | "none"	  | The model must not predict function calls. This behavior is equivalent to a model request without any associated function declarations.                 |
   * | string   | The string value must be one of the function names. This will force the model to predict the specified function call.                                   |
   *
   * The tool configuration's "any" mode ("forced function calling") is supported for Gemini 1.5 Pro models only.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool_choice?: string | "auto" | "any" | "none" | Record<string, any>;
  /**
   * Allowed functions to call when the mode is "any".
   * If empty, any one of the provided functions are called.
   */
  allowed_function_names?: string[];

  /**
   * Used to specify a previously created context cache to use with generation.
   * For Vertex, this should be of the form:
   * "projects/PROJECT_NUMBER/locations/LOCATION/cachedContents/CACHE_ID",
   *
   * See these guides for more information on how to use context caching:
   * https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-create
   * https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-use
   */
  cachedContent?: string;
}

export interface GoogleAIBaseLLMInput<AuthOptions>
  extends BaseLLMParams,
    GoogleConnectionParams<AuthOptions>,
    GoogleAIModelParams,
    GoogleAISafetyParams,
    GoogleAIAPIParams {}

export interface GoogleAIBaseLanguageModelCallOptions
  extends BaseChatModelCallOptions,
    GoogleAIModelRequestParams,
    GoogleAISafetyParams {
  /**
   * Whether or not to include usage data, like token counts
   * in the streamed response chunks.
   * @default true
   */
  streamUsage?: boolean;
}

/**
 * Input to LLM class.
 */
export interface GoogleBaseLLMInput<AuthOptions>
  extends GoogleAIBaseLLMInput<AuthOptions> {}

export interface GoogleResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface GoogleRawResponse extends GoogleResponse {
  data: Blob;
}

export interface GeminiPartBase {
  thought?: boolean; // Output only
  thoughtSignature?: string;
}

export interface GeminiVideoMetadata {
  fps?: number; // Double in range (0.0, 24.0]
  startOffset?: string;
  endOffset?: string;
}

export interface GeminiPartBaseFile extends GeminiPartBase {
  videoMetadata?: GeminiVideoMetadata;
}

export interface GeminiPartText extends GeminiPartBase {
  text: string;
}

export interface GeminiPartInlineData extends GeminiPartBaseFile {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiPartFileData extends GeminiPartBaseFile {
  fileData: {
    mimeType: string;
    fileUri: string;
  };
}

// AI Studio only?
export interface GeminiPartFunctionCall extends GeminiPartBase {
  functionCall: {
    name: string;
    args?: object;
  };
}

// AI Studio Only?
export interface GeminiPartFunctionResponse extends GeminiPartBase {
  functionResponse: {
    name: string;
    response: object;
  };
}

export type GeminiPart =
  | GeminiPartText
  | GeminiPartInlineData
  | GeminiPartFileData
  | GeminiPartFunctionCall
  | GeminiPartFunctionResponse;

export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

export type GeminiSafetyRating = {
  category: string;
  probability: string;
} & Record<string, unknown>;

export interface GeminiCitationMetadata {
  citations: GeminiCitation[];
}

export interface GeminiCitation {
  startIndex: number;
  endIndex: number;
  uri: string;
  title: string;
  license: string;
  publicationDate: GoogleTypeDate;
}

export interface GoogleTypeDate {
  year: number; // 1-9999 or 0 to specify a date without a year
  month: number; // 1-12 or 0 to specify a year without a month and day
  day: number; // Must be from 1 to 31 and valid for the year and month, or 0 to specify a year by itself or a year and month where the day isn't significant
}

export interface GeminiGroundingMetadata {
  webSearchQueries?: string[];
  searchEntryPoint?: GeminiSearchEntryPoint;
  groundingChunks: GeminiGroundingChunk[];
  groundingSupports?: GeminiGroundingSupport[];
  retrievalMetadata?: GeminiRetrievalMetadata;
}

export interface GeminiSearchEntryPoint {
  renderedContent?: string;
  sdkBlob?: string; // Base64 encoded JSON representing array of tuple.
}

export interface GeminiGroundingChunk {
  web: GeminiGroundingChunkWeb;
  retrievedContext: GeminiGroundingChunkRetrievedContext;
}

export interface GeminiGroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GeminiGroundingChunkRetrievedContext {
  uri: string;
  title: string;
  text: string;
}

export interface GeminiGroundingSupport {
  segment: GeminiSegment;
  groundingChunkIndices: number[];
  confidenceScores: number[];
}

export interface GeminiSegment {
  partIndex: number;
  startIndex: number;
  endIndex: number;
  text: string;
}

export interface GeminiRetrievalMetadata {
  googleSearchDynamicRetrievalScore: number;
}

export type GeminiUrlRetrievalStatus =
  | "URL_RETRIEVAL_STATUS_SUCCESS"
  | "URL_RETRIEVAL_STATUS_ERROR";

export interface GeminiUrlRetrievalContext {
  retrievedUrl: string;
  urlRetrievalStatus: GeminiUrlRetrievalStatus;
}

export interface GeminiUrlRetrievalMetadata {
  urlRetrievalContexts: GeminiUrlRetrievalContext[];
}

export type GeminiUrlMetadata = GeminiUrlRetrievalContext;

export interface GeminiUrlContextMetadata {
  urlMetadata: GeminiUrlMetadata[];
}

export interface GeminiLogprobsResult {
  topCandidates: GeminiLogprobsTopCandidate[];
  chosenCandidates: GeminiLogprobsResultCandidate[];
}

export interface GeminiLogprobsTopCandidate {
  candidates: GeminiLogprobsResultCandidate[];
}

export interface GeminiLogprobsResultCandidate {
  token: string;
  tokenId: number;
  logProbability: number;
}

// The "system" content appears to only be valid in the systemInstruction
export type GeminiRole = "system" | "user" | "model" | "function";

export interface GeminiContent {
  parts: GeminiPart[];
  role: GeminiRole; // Vertex AI requires the role
}

/*
 * If additional attributes are added here, they should also be
 * added to the attributes below
 */
export interface GeminiTool {
  functionDeclarations?: GeminiFunctionDeclaration[];
  googleSearchRetrieval?: GoogleSearchRetrieval; // Gemini-1.5
  googleSearch?: GoogleSearch; // Gemini-2.0
  urlContext?: UrlContext;
  retrieval?: VertexAIRetrieval;
}

/*
 * The known strings in this type should match those in GeminiSearchToolAttribuets
 */
export type GoogleSearchToolSetting =
  | boolean
  | "googleSearchRetrieval"
  | "googleSearch"
  | string;

export const GeminiSearchToolAttributes = [
  "googleSearchRetrieval",
  "googleSearch",
];

export const GeminiToolAttributes = [
  "functionDeclaration",
  "retrieval",
  "urlContext",
  ...GeminiSearchToolAttributes,
];

export interface GoogleSearchRetrieval {
  dynamicRetrievalConfig?: {
    mode?: string;
    dynamicThreshold?: number;
  };
}

export interface GoogleSearch {}

export interface UrlContext {}

export interface VertexAIRetrieval {
  vertexAiSearch: {
    datastore: string;
  };
  disableAttribution?: boolean;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiFunctionSchema;
}

export interface GeminiFunctionSchema {
  type: GeminiFunctionSchemaType;
  format?: string;
  description?: string;
  nullable?: boolean;
  enum?: string[];
  properties?: Record<string, GeminiFunctionSchema>;
  required?: string[];
  items?: GeminiFunctionSchema;
}

export type GeminiFunctionSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";

export interface GeminiGenerationConfig {
  stopSequences?: string[];
  candidateCount?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  seed?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseMimeType?: GoogleAIResponseMimeType;
  responseLogprobs?: boolean;
  logprobs?: number;
  responseModalities?: GoogleAIModelModality[];
  thinkingConfig?: GoogleThinkingConfig;
  speechConfig?: GoogleSpeechConfig;
}

export interface GeminiRequest {
  contents?: GeminiContent[];
  systemInstruction?: GeminiContent;
  tools?: GeminiTool[];
  toolConfig?: {
    functionCallingConfig: {
      mode: "auto" | "any" | "none";
      allowedFunctionNames?: string[];
    };
  };
  safetySettings?: GeminiSafetySetting[];
  generationConfig?: GeminiGenerationConfig;
  cachedContent?: string;

  /**
   * Custom metadata labels to associate with the API call.
   */
  labels?: Record<string, string>;
}

export interface GeminiResponseCandidate {
  content: {
    parts: GeminiPart[];
    role: string;
  };
  finishReason: string;
  index: number;
  tokenCount?: number;
  safetyRatings: GeminiSafetyRating[];
  citationMetadata?: GeminiCitationMetadata;
  groundingMetadata?: GeminiGroundingMetadata;
  urlRetrievalMetadata?: GeminiUrlRetrievalMetadata;
  urlContextMetadata?: GeminiUrlContextMetadata;
  avgLogprobs?: number;
  logprobsResult: GeminiLogprobsResult;
  finishMessage?: string;
}

interface GeminiResponsePromptFeedback {
  blockReason?: string;
  safetyRatings: GeminiSafetyRating[];
}

export type ModalityEnum =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | string;

export interface ModalityTokenCount {
  modality: ModalityEnum;
  tokenCount: number;
}

export interface GenerateContentResponseUsageMetadata {
  promptTokenCount: number;
  toolUsePromptTokenCount: number;
  cachedContentTokenCount: number;
  thoughtsTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;

  promptTokensDetails: ModalityTokenCount[];
  toolUsePromptTokensDetails: ModalityTokenCount[];
  cacheTokensDetails: ModalityTokenCount[];
  candidatesTokensDetails: ModalityTokenCount[];

  [key: string]: unknown;
}

export interface GenerateContentResponseData {
  candidates: GeminiResponseCandidate[];
  promptFeedback: GeminiResponsePromptFeedback;
  usageMetadata: GenerateContentResponseUsageMetadata;
}

export type GoogleLLMModelFamily = null | "palm" | "gemini" | "gemma";

export type VertexModelFamily = GoogleLLMModelFamily | "claude";

export type GoogleLLMResponseData =
  | JsonStream
  | GenerateContentResponseData
  | GenerateContentResponseData[];

export interface GoogleLLMResponse extends GoogleResponse {
  data: GoogleLLMResponseData | AnthropicResponseData;
}

export interface GoogleAISafetyHandler {
  /**
   * A function that will take a response and return the, possibly modified,
   * response or throw an exception if there are safety issues.
   *
   * @throws GoogleAISafetyError
   */
  handle(response: GoogleLLMResponse): GoogleLLMResponse;
}

export interface GoogleAISafetyParams {
  safetyHandler?: GoogleAISafetyHandler;
}

export type GeminiJsonSchema = Record<string, unknown> & {
  properties?: Record<string, GeminiJsonSchema>;
  type: GeminiFunctionSchemaType;
  nullable?: boolean;
};

export interface GeminiJsonSchemaDirty extends GeminiJsonSchema {
  items?: GeminiJsonSchemaDirty;
  properties?: Record<string, GeminiJsonSchemaDirty>;
  additionalProperties?: boolean;
}

export type GoogleAIAPI = {
  messageContentToParts?: (content: MessageContent) => Promise<GeminiPart[]>;

  baseMessageToContent?: (
    message: BaseMessage,
    prevMessage: BaseMessage | undefined,
    useSystemInstruction: boolean
  ) => Promise<GeminiContent[]>;

  responseToString: (response: GoogleLLMResponse) => string;

  responseToChatGeneration: (
    response: GoogleLLMResponse
  ) => ChatGenerationChunk | null;

  chunkToString: (chunk: BaseMessageChunk) => string;

  responseToBaseMessage: (response: GoogleLLMResponse) => BaseMessage;

  responseToChatResult: (response: GoogleLLMResponse) => ChatResult;

  formatData: (
    input: unknown,
    parameters: GoogleAIModelRequestParams
  ) => Promise<unknown>;
};

export interface GeminiAPIConfig {
  safetyHandler?: GoogleAISafetyHandler;
  mediaManager?: MediaManager;
  useSystemInstruction?: boolean;

  /**
   * How to handle the Google Search tool, since the name (and format)
   * of the tool changes between Gemini 1.5 and Gemini 2.0.
   * true - Change based on the model version. (Default)
   * false - Do not change the tool name provided
   * string value - Use this as the attribute name for the search
   *   tool, adapting any tool attributes if possible.
   * When the model is created, a "true" or default setting
   * will be changed to a string based on the model.
   */
  googleSearchToolAdjustment?: GoogleSearchToolSetting;
}

export type GoogleAIAPIConfig = GeminiAPIConfig | AnthropicAPIConfig;

export interface GoogleAIAPIParams {
  apiName?: string;
  apiConfig?: GoogleAIAPIConfig;
}

// Embeddings

/**
 * Defines the parameters required to initialize a
 * GoogleEmbeddings instance. It extends EmbeddingsParams and
 * GoogleConnectionParams.
 */
export interface BaseGoogleEmbeddingsParams<AuthOptions>
  extends EmbeddingsParams,
    GoogleConnectionParams<AuthOptions> {
  model: string;

  /**
   * Used to specify output embedding size.
   * If set, output embeddings will be truncated to the size specified.
   */
  dimensions?: number;

  /**
   * An alias for "dimensions"
   */
  outputDimensionality?: number;
}

/**
 * Defines additional options specific to the
 * GoogleEmbeddingsInstance. It extends AsyncCallerCallOptions.
 */
export interface BaseGoogleEmbeddingsOptions extends AsyncCallerCallOptions {}

export type GoogleEmbeddingsTaskType =
  | "RETRIEVAL_QUERY"
  | "RETRIEVAL_DOCUMENT"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING"
  | "QUESTION_ANSWERING"
  | "FACT_VERIFICATION"
  | "CODE_RETRIEVAL_QUERY"
  | string;

/**
 * Represents an instance for generating embeddings using the Google
 * Vertex AI API. It contains the content to be embedded.
 */
export interface VertexEmbeddingsInstance {
  content: string;
  taskType?: GoogleEmbeddingsTaskType;
  title?: string;
}

export interface VertexEmbeddingsParameters extends GoogleModelParams {
  autoTruncate?: boolean;
  outputDimensionality?: number;
}

export interface VertexEmbeddingsRequest {
  instances: VertexEmbeddingsInstance[];
  parameters?: VertexEmbeddingsParameters;
}

export interface AIStudioEmbeddingsRequest {
  content: {
    parts: GeminiPartText[];
  };
  model?: string; // Documentation says required, but tests say otherwise
  taskType?: GoogleEmbeddingsTaskType;
  title?: string;
  outputDimensionality?: number;
}

export type GoogleEmbeddingsRequest =
  | VertexEmbeddingsRequest
  | AIStudioEmbeddingsRequest;

export interface VertexEmbeddingsResponsePrediction {
  embeddings: {
    statistics: {
      token_count: number;
      truncated: boolean;
    };
    values: number[];
  };
}

/**
 * Defines the structure of the embeddings results returned by the Google
 * Vertex AI API. It extends GoogleBasePrediction and contains the
 * embeddings and their statistics.
 */
export interface VertexEmbeddingsResponse extends GoogleResponse {
  data: {
    predictions: VertexEmbeddingsResponsePrediction[];
  };
}

export interface AIStudioEmbeddingsResponse extends GoogleResponse {
  data: {
    embedding: {
      values: number[];
    };
  };
}

export type GoogleEmbeddingsResponse =
  | VertexEmbeddingsResponse
  | AIStudioEmbeddingsResponse;
