// Auto-generated from the OpenRouter OpenAPI spec using SparkType
// (https://hntrl.github.io/sparktype/). SparkType converts
// schemas into TypeScript types, so these stay in sync with the upstream API.
// Do not edit manually — regenerate with: pnpm typegen

export namespace OpenRouter {
  export interface ChatMessageContentItemText {
    cache_control?: ChatMessageContentItemCacheControl;
    text: string;
    type: string;
  }

  export interface ChatMessageContentItemImage {
    image_url: {
      detail?: "auto" | "low" | "high" | (string & {});
      url: string;
    };
    type: string;
  }

  export interface ChatMessageContentItemAudio {
    input_audio: { data: string; format: string };
    type: string;
  }

  export interface ChatMessageContentItemVideo {}

  export interface ChatMessageContentItem {}

  export interface ChatMessageContentItemCacheControl {
    ttl?: "5m" | "1h" | (string & {});
    type: string;
  }

  export interface SystemMessage {
    content: string | Array<ChatMessageContentItemText>;
    name?: string;
    role: string;
  }

  export interface UserMessage {
    content: string | Array<ChatMessageContentItem>;
    name?: string;
    role: string;
  }

  export interface DeveloperMessage {
    content: string | Array<ChatMessageContentItemText>;
    name?: string;
    role: string;
  }

  export interface AssistantMessage {
    content?: string | Array<ChatMessageContentItem> | null;
    images?: Array<{ image_url: { url: string } }>;
    name?: string;
    reasoning?: string | null;
    reasoning_details?: Array<__schema19>;
    refusal?: string | null;
    role: string;
    tool_calls?: Array<ChatMessageToolCall>;
  }

  export interface ToolResponseMessage {
    content: string | Array<ChatMessageContentItem>;
    role: string;
    tool_call_id: string;
  }

  export interface Message {}

  export interface ToolDefinitionJson {
    function: {
      description?: string;
      name: string;
      parameters?: Record<string, unknown>;
      strict?: boolean | null;
    };
    type: string;
  }

  export interface NamedToolChoice {
    function: { name: string };
    type: string;
  }

  export type ToolChoiceOption = string | string | string | NamedToolChoice;

  export interface ChatMessageToolCall {
    function: { arguments: string; name: string };
    id: string;
    type: string;
  }

  export interface ChatStreamingMessageToolCall {
    function?: { arguments?: string; name?: string };
    id?: string;
    index: number;
    type?: string;
  }

  export interface JSONSchemaConfig {
    description?: string;
    name: string;
    schema?: Record<string, unknown>;
    strict?: boolean | null;
  }

  export interface ResponseFormatJSONSchema {
    json_schema: JSONSchemaConfig;
    type: string;
  }

  export interface ResponseFormatTextGrammar {
    grammar: string;
    type: string;
  }

  export interface ChatStreamOptions {
    include_usage?: boolean;
  }

  export interface ChatGenerationParams {
    debug?: { echo_upstream_body?: boolean };
    frequency_penalty?: number | null;
    image_config?: Record<string, unknown>;
    logit_bias?: Record<string, unknown> | null;
    logprobs?: boolean | null;
    max_completion_tokens?: number | null;
    max_tokens?: number | null;
    messages: Array<Message>;
    metadata?: Record<string, unknown>;
    modalities?: Array<"text" | "image" | (string & {})>;
    model?: ModelName;
    models?: Array<ModelName>;
    plugins?: __schema17;
    presence_penalty?: number | null;
    provider?: __schema0;
    reasoning?: {
      effort?:
        | "xhigh"
        | "high"
        | "medium"
        | "low"
        | "minimal"
        | "none"
        | (string & {})
        | null;
      summary?: ReasoningSummaryVerbosity | null;
    };
    response_format?:
      | { type: string }
      | { type: string }
      | ResponseFormatJSONSchema
      | ResponseFormatTextGrammar
      | { type: string };
    route?: "fallback" | "sort" | (string & {}) | null;
    seed?: number | null;
    session_id?: __schema18;
    stop?: string | Array<ModelName> | null;
    stream?: boolean;
    stream_options?: ChatStreamOptions | null;
    temperature?: number | null;
    tool_choice?: ToolChoiceOption;
    tools?: Array<ToolDefinitionJson>;
    top_logprobs?: number | null;
    top_p?: number | null;
    user?: string;
  }

  /** Provider routing preferences for the request. */
  export interface ProviderPreferences {
    /**
     * Whether to allow backup providers to serve requests
     * - true: (default) when the primary provider (or your custom providers in "order") is unavailable, use the next best provider.
     * - false: use only the primary/custom provider, and return the upstream error if it's unavailable.
     *
     */
    allow_fallbacks?: boolean | null;

    /**
     * Data collection setting. If no available model provider meets the requirement, your request will return an error.
     * - allow: (default) allow providers which store user data non-transiently and may train on it
     *
     * - deny: use only providers which do not collect user data.
     */
    data_collection?: DataCollection;

    /**
     * Whether to restrict routing to only models that allow text distillation. When true, only models where the author has allowed distillation will be used.
     */
    enforce_distillable_text?: boolean | null;

    /**
     * List of provider slugs to ignore. If provided, this list is merged with your account-wide ignored provider settings for this request.
     */
    ignore?: Array<ProviderName | string> | null;

    /**
     * The object specifying the maximum price you want to pay for this request. USD price per million tokens, for prompt and completion.
     */
    max_price?: {
      audio?: BigNumberUnion & unknown;
      completion?: BigNumberUnion & unknown;
      image?: BigNumberUnion & unknown;
      prompt?: BigNumberUnion;
      request?: BigNumberUnion & unknown;
    };

    /**
     * List of provider slugs to allow. If provided, this list is merged with your account-wide allowed provider settings for this request.
     */
    only?: Array<ProviderName | string> | null;

    /**
     * An ordered list of provider slugs. The router will attempt to use the first provider in the subset of this list that supports your requested model, and fall back to the next if it is unavailable. If no providers are available, the request will fail with an error message.
     */
    order?: Array<ProviderName | string> | null;

    /**
     * Preferred maximum latency (in seconds). Can be a number (applies to p50) or an object with percentile-specific cutoffs. Endpoints above the threshold(s) may still be used, but are deprioritized in routing. When using fallback models, this may cause a fallback model to be used instead of the primary model if it meets the threshold.
     */
    preferred_max_latency?: PreferredMaxLatency;

    /**
     * Preferred minimum throughput (in tokens per second). Can be a number (applies to p50) or an object with percentile-specific cutoffs. Endpoints below the threshold(s) may still be used, but are deprioritized in routing. When using fallback models, this may cause a fallback model to be used instead of the primary model if it meets the threshold.
     */
    preferred_min_throughput?: PreferredMinThroughput;

    /** A list of quantization levels to filter the provider by. */
    quantizations?: Array<Quantization> | null;

    /**
     * Whether to filter providers to only those that support the parameters you've provided. If this setting is omitted or set to false, then providers will receive only the parameters they support, and ignore the rest.
     */
    require_parameters?: boolean | null;
    sort?: ProviderSortUnion;

    /**
     * Whether to restrict routing to only ZDR (Zero Data Retention) endpoints. When true, only endpoints that do not retain prompts will be used.
     */
    zdr?: boolean | null;
  }

  export type ProviderSortUnion = ProviderSort | ProviderSortConfig;

  export interface ChatGenerationTokenUsage {
    completion_tokens: number;
    completion_tokens_details?: {
      accepted_prediction_tokens?: number | null;
      audio_tokens?: number | null;
      reasoning_tokens?: number | null;
      rejected_prediction_tokens?: number | null;
    } | null;
    prompt_tokens: number;
    prompt_tokens_details?: {
      audio_tokens?: number;
      cache_write_tokens?: number;
      cached_tokens?: number;
      video_tokens?: number;
    } | null;
    total_tokens: number;
  }

  export type ChatCompletionFinishReason =
    | "tool_calls"
    | "stop"
    | "length"
    | "content_filter"
    | "error"
    | (string & {});

  export interface ChatMessageTokenLogprob {
    bytes: Array<number> | null;
    logprob: number;
    token: string;
    top_logprobs: Array<{
      bytes: Array<number> | null;
      logprob: number;
      token: string;
    }>;
  }

  export interface ChatMessageTokenLogprobs {
    content: Array<ChatMessageTokenLogprob> | null;
    refusal: Array<ChatMessageTokenLogprob> | null;
  }

  export interface ChatResponseChoice {
    finish_reason: __schema25;
    index: number;
    logprobs?: ChatMessageTokenLogprobs | null;
    message: AssistantMessage;
  }

  export interface ChatResponse {
    choices: Array<ChatResponseChoice>;
    created: number;
    id: string;
    model: string;
    object: string;
    system_fingerprint?: string | null;
    usage?: ChatGenerationTokenUsage;
  }

  export interface ChatStreamingMessageChunk {
    content?: string | null;
    reasoning?: string | null;
    reasoning_details?: Array<__schema19>;
    refusal?: string | null;
    role?: "assistant" | (string & {});
    tool_calls?: Array<ChatStreamingMessageToolCall>;
  }

  export interface ChatStreamingChoice {
    delta: ChatStreamingMessageChunk;
    finish_reason: __schema25;
    index: number;
    logprobs?: ChatMessageTokenLogprobs | null;
  }

  export interface ChatStreamingResponseChunk {
    data: {
      choices: Array<ChatStreamingChoice>;
      created: number;
      error?: { code: number; message: string };
      id: string;
      model: string;
      object: string;
      system_fingerprint?: string | null;
      usage?: ChatGenerationTokenUsage;
    };
  }

  export interface ChatError {
    error: {
      code: string | number | null;
      message: string;
      param?: string | null;
      type?: string | null;
    };
  }

  export type __schema17 = Array<
    | { allowed_models?: Array<string>; enabled?: boolean; id: string }
    | { id: string }
    | {
        enabled?: boolean;
        engine?: "native" | "exa" | (string & {});
        id: string;
        max_results?: number;
        search_prompt?: string;
      }
    | {
        enabled?: boolean;
        id: string;
        pdf?: {
          engine?: "mistral-ocr" | "pdf-text" | "native" | (string & {});
        };
      }
    | { enabled?: boolean; id: string }
  >;

  export type __schema18 = string;

  /**
   * Data collection setting. If no available model provider meets the requirement, your request will return an error.
   * - allow: (default) allow providers which store user data non-transiently and may train on it
   *
   * - deny: use only providers which do not collect user data.
   */
  export type DataCollection = "deny" | "allow" | (string & {});

  /**
   * Preferred minimum throughput (in tokens per second). Can be a number (applies to p50) or an object with percentile-specific cutoffs. Endpoints below the threshold(s) may still be used, but are deprioritized in routing. When using fallback models, this may cause a fallback model to be used instead of the primary model if it meets the threshold.
   */
  export type PreferredMinThroughput = number | PercentileThroughputCutoffs;

  export interface ProviderSortConfig {
    by?: ProviderSort | null;
    partition?: "model" | "none" | (string & {}) | null;
  }

  export type ModelName = string;

  export type ReasoningSummaryVerbosity =
    | "auto"
    | "concise"
    | "detailed"
    | (string & {});

  export type Quantization =
    | "int4"
    | "int8"
    | "fp4"
    | "fp6"
    | "fp8"
    | "fp16"
    | "bf16"
    | "fp32"
    | "unknown"
    | (string & {});

  export interface __schema19 {}

  export type ProviderName =
    | "AI21"
    | "AionLabs"
    | "Alibaba"
    | "Ambient"
    | "Amazon Bedrock"
    | "Amazon Nova"
    | "Anthropic"
    | "Arcee AI"
    | "AtlasCloud"
    | "Avian"
    | "Azure"
    | "BaseTen"
    | "BytePlus"
    | "Black Forest Labs"
    | "Cerebras"
    | "Chutes"
    | "Cirrascale"
    | "Clarifai"
    | "Cloudflare"
    | "Cohere"
    | "Crusoe"
    | "DeepInfra"
    | "DeepSeek"
    | "Featherless"
    | "Fireworks"
    | "Friendli"
    | "GMICloud"
    | "Google"
    | "Google AI Studio"
    | "Groq"
    | "Hyperbolic"
    | "Inception"
    | "Inceptron"
    | "InferenceNet"
    | "Infermatic"
    | "Inflection"
    | "Liquid"
    | "Mara"
    | "Mancer 2"
    | "Minimax"
    | "ModelRun"
    | "Mistral"
    | "Modular"
    | "Moonshot AI"
    | "Morph"
    | "NCompass"
    | "Nebius"
    | "NextBit"
    | "Novita"
    | "Nvidia"
    | "OpenAI"
    | "OpenInference"
    | "Parasail"
    | "Perplexity"
    | "Phala"
    | "Relace"
    | "SambaNova"
    | "Seed"
    | "SiliconFlow"
    | "Sourceful"
    | "StepFun"
    | "Stealth"
    | "StreamLake"
    | "Switchpoint"
    | "Together"
    | "Upstage"
    | "Venice"
    | "WandB"
    | "Xiaomi"
    | "xAI"
    | "Z.AI"
    | "FakeProvider"
    | (string & {});

  export type ProviderSort = "price" | "throughput" | "latency" | (string & {});

  export type __schema25 = ChatCompletionFinishReason | null;

  export type __schema0 = {
    allow_fallbacks?: __schema1;
    data_collection?: __schema3;
    enforce_distillable_text?: boolean | null;
    ignore?: __schema4;
    max_price?: __schema10;
    only?: __schema4;
    order?: __schema4;
    preferred_max_latency?: __schema15;
    preferred_min_throughput?: __schema15;
    quantizations?: __schema8;
    require_parameters?: __schema1;
    sort?: __schema9;
    zdr?: boolean | null;
  } | null;

  /** Price per million prompt tokens */
  export type BigNumberUnion = string;

  /**
   * Preferred maximum latency (in seconds). Can be a number (applies to p50) or an object with percentile-specific cutoffs. Endpoints above the threshold(s) may still be used, but are deprioritized in routing. When using fallback models, this may cause a fallback model to be used instead of the primary model if it meets the threshold.
   */
  export type PreferredMaxLatency = number | PercentileLatencyCutoffs;

  export type __schema21 =
    | "unknown"
    | "openai-responses-v1"
    | "azure-openai-responses-v1"
    | "xai-responses-v1"
    | "anthropic-claude-v1"
    | "google-gemini-v1"
    | (string & {})
    | null;

  export type __schema3 = "deny" | "allow" | (string & {}) | null;

  export type __schema4 = __schema5 | null;

  export type __schema15 =
    | number
    | {
        p50?: number | null;
        p75?: number | null;
        p90?: number | null;
        p99?: number | null;
      }
    | null;

  /**
   * Percentile-based latency cutoffs. All specified cutoffs must be met for an endpoint to be preferred.
   */
  export interface PercentileLatencyCutoffs {
    /** Maximum p50 latency (seconds) */
    p50?: number | null;

    /** Maximum p75 latency (seconds) */
    p75?: number | null;

    /** Maximum p90 latency (seconds) */
    p90?: number | null;

    /** Maximum p99 latency (seconds) */
    p99?: number | null;
  }

  export type __schema8 = Array<
    | "int4"
    | "int8"
    | "fp4"
    | "fp6"
    | "fp8"
    | "fp16"
    | "bf16"
    | "fp32"
    | "unknown"
    | (string & {})
  > | null;

  export type __schema9 = ProviderSortUnion | null;

  /**
   * Percentile-based throughput cutoffs. All specified cutoffs must be met for an endpoint to be preferred.
   */
  export interface PercentileThroughputCutoffs {
    /** Minimum p50 throughput (tokens/sec) */
    p50?: number | null;

    /** Minimum p75 throughput (tokens/sec) */
    p75?: number | null;

    /** Minimum p90 throughput (tokens/sec) */
    p90?: number | null;

    /** Minimum p99 throughput (tokens/sec) */
    p99?: number | null;
  }

  export type __schema20 = string | null;

  export type __schema11 = number;

  export type __schema1 = boolean | null;

  export interface __schema10 {
    audio?: __schema14;
    completion?: __schema11 | ModelName | __schema13;
    image?: __schema14;
    prompt?: __schema11 | ModelName | __schema13;
    request?: __schema14;
  }

  export type __schema5 = Array<
    | "AI21"
    | "AionLabs"
    | "Alibaba"
    | "Ambient"
    | "Amazon Bedrock"
    | "Amazon Nova"
    | "Anthropic"
    | "Arcee AI"
    | "AtlasCloud"
    | "Avian"
    | "Azure"
    | "BaseTen"
    | "BytePlus"
    | "Black Forest Labs"
    | "Cerebras"
    | "Chutes"
    | "Cirrascale"
    | "Clarifai"
    | "Cloudflare"
    | "Cohere"
    | "Crusoe"
    | "DeepInfra"
    | "DeepSeek"
    | "Featherless"
    | "Fireworks"
    | "Friendli"
    | "GMICloud"
    | "Google"
    | "Google AI Studio"
    | "Groq"
    | "Hyperbolic"
    | "Inception"
    | "Inceptron"
    | "InferenceNet"
    | "Infermatic"
    | "Inflection"
    | "Liquid"
    | "Mara"
    | "Mancer 2"
    | "Minimax"
    | "ModelRun"
    | "Mistral"
    | "Modular"
    | "Moonshot AI"
    | "Morph"
    | "NCompass"
    | "Nebius"
    | "NextBit"
    | "Novita"
    | "Nvidia"
    | "OpenAI"
    | "OpenInference"
    | "Parasail"
    | "Perplexity"
    | "Phala"
    | "Relace"
    | "SambaNova"
    | "Seed"
    | "SiliconFlow"
    | "Sourceful"
    | "StepFun"
    | "Stealth"
    | "StreamLake"
    | "Switchpoint"
    | "Together"
    | "Upstage"
    | "Venice"
    | "WandB"
    | "Xiaomi"
    | "xAI"
    | "Z.AI"
    | "FakeProvider"
    | (string & {})
    | string
  >;

  export type __schema14 = __schema11 | ModelName | __schema13;

  export type __schema13 = unknown;
}
