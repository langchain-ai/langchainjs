// Hand-written TypeScript types derived from the OpenRouter OpenAPI spec
// (openrouter.json, OpenAPI 3.1.0).
//
// Every type lives inside the `OpenRouter` namespace so consumers can
// reference them as `OpenRouter.ChatResponse`, etc.

export namespace OpenRouter {
  // ═══════════════════════════════════════════════════════════════════════
  // Primitive aliases
  // ═══════════════════════════════════════════════════════════════════════

  /** An OpenRouter model identifier, e.g. `"anthropic/claude-4-sonnet"`. */
  export type ModelName = string;

  /**
   * A string that represents a large number (price per million tokens).
   * Encoded as a string to avoid floating-point precision issues.
   */
  export type BigNumberUnion = string;

  // ═══════════════════════════════════════════════════════════════════════
  // Enum-like string unions
  // ═══════════════════════════════════════════════════════════════════════

  export type ReasoningSummaryVerbosity =
    | "auto"
    | "concise"
    | "detailed"
    | (string & {});

  export type DataCollection = "deny" | "allow" | (string & {});

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

  export type ProviderSort = "price" | "throughput" | "latency" | (string & {});

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
    | "Io Net"
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

  export type ChatCompletionFinishReason =
    | "tool_calls"
    | "stop"
    | "length"
    | "content_filter"
    | "error"
    | (string & {});

  export type ReasoningDetailFormat =
    | "unknown"
    | "openai-responses-v1"
    | "azure-openai-responses-v1"
    | "xai-responses-v1"
    | "anthropic-claude-v1"
    | "google-gemini-v1"
    | (string & {});

  // ═══════════════════════════════════════════════════════════════════════
  // Cache control
  // ═══════════════════════════════════════════════════════════════════════

  export interface ChatMessageContentItemCacheControl {
    type: "ephemeral";
    ttl?: "5m" | "1h" | (string & {});
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Content item types (discriminated on `type`)
  // ═══════════════════════════════════════════════════════════════════════

  export interface ChatMessageContentItemText {
    type: "text";
    text: string;
    cache_control?: ChatMessageContentItemCacheControl;
  }

  export interface ChatMessageContentItemImage {
    type: "image_url";
    image_url: {
      url: string;
      detail?: "auto" | "low" | "high" | (string & {});
    };
  }

  export interface ChatMessageContentItemAudio {
    type: "input_audio";
    input_audio: { data: string; format: string };
  }

  export type ChatMessageContentItemVideo =
    | { type: "input_video"; video_url: { url: string } }
    | { type: "video_url"; video_url: { url: string } };

  /** Discriminated union of all content part types (discriminant: `type`). */
  export type ChatMessageContentItem =
    | ChatMessageContentItemText
    | ChatMessageContentItemImage
    | ChatMessageContentItemAudio
    | ChatMessageContentItemVideo;

  // ═══════════════════════════════════════════════════════════════════════
  // Reasoning detail types (discriminated on `type`)
  // ═══════════════════════════════════════════════════════════════════════

  interface ReasoningDetailBase {
    id?: string | null;
    format?: ReasoningDetailFormat | null;
    index?: number;
  }

  export interface ReasoningSummaryDetail extends ReasoningDetailBase {
    type: "reasoning.summary";
    summary: string;
  }

  export interface ReasoningEncryptedDetail extends ReasoningDetailBase {
    type: "reasoning.encrypted";
    data: string;
  }

  export interface ReasoningTextDetail extends ReasoningDetailBase {
    type: "reasoning.text";
    text?: string | null;
    signature?: string | null;
  }

  export type ReasoningDetail =
    | ReasoningSummaryDetail
    | ReasoningEncryptedDetail
    | ReasoningTextDetail;

  // ═══════════════════════════════════════════════════════════════════════
  // Messages (discriminated on `role`)
  // ═══════════════════════════════════════════════════════════════════════

  export interface SystemMessage {
    role: "system";
    content: string | ChatMessageContentItemText[];
    name?: string;
  }

  export interface UserMessage {
    role: "user";
    content: string | ChatMessageContentItem[];
    name?: string;
  }

  export interface DeveloperMessage {
    role: "developer";
    content: string | ChatMessageContentItemText[];
    name?: string;
  }

  export interface AssistantMessage {
    role: "assistant";
    content?: string | ChatMessageContentItem[] | null;
    name?: string;
    tool_calls?: ChatMessageToolCall[];
    refusal?: string | null;
    reasoning?: string | null;
    reasoning_details?: ReasoningDetail[];
    images?: Array<{ image_url: { url: string } }>;
  }

  export interface ToolResponseMessage {
    role: "tool";
    content: string | ChatMessageContentItem[];
    tool_call_id: string;
  }

  /** Discriminated union of all message types (discriminant: `role`). */
  export type Message =
    | SystemMessage
    | UserMessage
    | DeveloperMessage
    | AssistantMessage
    | ToolResponseMessage;

  // ═══════════════════════════════════════════════════════════════════════
  // Tool calls
  // ═══════════════════════════════════════════════════════════════════════

  export interface ChatMessageToolCall {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }

  export interface ChatStreamingMessageToolCall {
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Tool definitions & tool choice
  // ═══════════════════════════════════════════════════════════════════════

  export interface ToolDefinitionJson {
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
      strict?: boolean | null;
    };
    cache_control?: ChatMessageContentItemCacheControl;
  }

  export interface NamedToolChoice {
    type: "function";
    function: { name: string };
  }

  export type ToolChoiceOption = "none" | "auto" | "required" | NamedToolChoice;

  // ═══════════════════════════════════════════════════════════════════════
  // Response format
  // ═══════════════════════════════════════════════════════════════════════

  export interface JSONSchemaConfig {
    name: string;
    description?: string;
    schema?: Record<string, unknown>;
    strict?: boolean | null;
  }

  export interface ResponseFormatJSONSchema {
    type: "json_schema";
    json_schema: JSONSchemaConfig;
  }

  export interface ResponseFormatTextGrammar {
    type: "grammar";
    grammar: string;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Logprobs
  // ═══════════════════════════════════════════════════════════════════════

  export interface ChatMessageTokenLogprob {
    token: string;
    logprob: number;
    bytes: number[] | null;
    top_logprobs: Array<{
      token: string;
      logprob: number;
      bytes: number[] | null;
    }>;
  }

  export interface ChatMessageTokenLogprobs {
    content: ChatMessageTokenLogprob[] | null;
    refusal: ChatMessageTokenLogprob[] | null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Token usage
  // ═══════════════════════════════════════════════════════════════════════

  export interface ChatGenerationTokenUsage {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
    completion_tokens_details?: {
      reasoning_tokens?: number | null;
      audio_tokens?: number | null;
      accepted_prediction_tokens?: number | null;
      rejected_prediction_tokens?: number | null;
    } | null;
    prompt_tokens_details?: {
      cached_tokens?: number;
      cache_write_tokens?: number;
      audio_tokens?: number;
      video_tokens?: number;
    } | null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Provider routing & preferences
  // ═══════════════════════════════════════════════════════════════════════

  export interface PercentileLatencyCutoffs {
    p50?: number | null;
    p75?: number | null;
    p90?: number | null;
    p99?: number | null;
  }

  export interface PercentileThroughputCutoffs {
    p50?: number | null;
    p75?: number | null;
    p90?: number | null;
    p99?: number | null;
  }

  export type PreferredMaxLatency = number | PercentileLatencyCutoffs;
  export type PreferredMinThroughput = number | PercentileThroughputCutoffs;

  export interface ProviderSortConfig {
    by?: ProviderSort | null;
    partition?: "model" | "none" | (string & {}) | null;
  }

  export type ProviderSortUnion = ProviderSort | ProviderSortConfig;

  export interface ProviderPreferences {
    allow_fallbacks?: boolean | null;
    require_parameters?: boolean | null;
    data_collection?: DataCollection;
    zdr?: boolean | null;
    enforce_distillable_text?: boolean | null;
    order?: Array<ProviderName | string> | null;
    only?: Array<ProviderName | string> | null;
    ignore?: Array<ProviderName | string> | null;
    quantizations?: Quantization[] | null;
    sort?: ProviderSortUnion | null;
    max_price?: {
      prompt?: BigNumberUnion;
      completion?: BigNumberUnion;
      image?: BigNumberUnion;
      audio?: BigNumberUnion;
      request?: BigNumberUnion;
    };
    preferred_min_throughput?: PreferredMinThroughput;
    preferred_max_latency?: PreferredMaxLatency;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Plugins
  // ═══════════════════════════════════════════════════════════════════════

  export interface AutoRouterPlugin {
    id: "auto-router";
    enabled?: boolean;
    allowed_models?: string[];
  }

  export interface ModerationPlugin {
    id: "moderation";
  }

  export interface WebPlugin {
    id: "web";
    enabled?: boolean;
    max_results?: number;
    search_prompt?: string;
    engine?: "native" | "exa" | (string & {});
  }

  export interface FileParserPlugin {
    id: "file-parser";
    enabled?: boolean;
    pdf?: {
      engine?: "mistral-ocr" | "pdf-text" | "native" | (string & {});
    };
  }

  export interface ResponseHealingPlugin {
    id: "response-healing";
    enabled?: boolean;
  }

  export type PluginDefinition =
    | AutoRouterPlugin
    | ModerationPlugin
    | WebPlugin
    | FileParserPlugin
    | ResponseHealingPlugin
    | { id: string; [key: string]: unknown };

  // ═══════════════════════════════════════════════════════════════════════
  // Trace / observability metadata
  // ═══════════════════════════════════════════════════════════════════════

  export interface TraceConfig {
    trace_id?: string;
    trace_name?: string;
    span_name?: string;
    generation_name?: string;
    parent_span_id?: string;
    [key: string]: unknown;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Stream options
  // ═══════════════════════════════════════════════════════════════════════

  export interface ChatStreamOptions {
    include_usage?: boolean;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Chat generation request
  // ═══════════════════════════════════════════════════════════════════════

  export interface ChatGenerationParams {
    messages: Message[];
    model?: ModelName;
    models?: ModelName[];
    provider?: ProviderPreferences | null;
    plugins?: PluginDefinition[];
    route?: "fallback" | "sort" | (string & {}) | null;
    user?: string;
    session_id?: string;
    trace?: TraceConfig;
    frequency_penalty?: number | null;
    logit_bias?: Record<string, number> | null;
    logprobs?: boolean | null;
    top_logprobs?: number | null;
    max_completion_tokens?: number | null;
    max_tokens?: number | null;
    metadata?: Record<string, string>;
    presence_penalty?: number | null;
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
      | { type: "text" }
      | { type: "json_object" }
      | ResponseFormatJSONSchema
      | ResponseFormatTextGrammar
      | { type: "python" };
    seed?: number | null;
    stop?: string | string[] | null;
    stream?: boolean;
    stream_options?: ChatStreamOptions | null;
    temperature?: number | null;
    parallel_tool_calls?: boolean | null;
    tool_choice?: ToolChoiceOption;
    tools?: ToolDefinitionJson[];
    top_p?: number | null;
    debug?: { echo_upstream_body?: boolean };
    image_config?: Record<string, string | number | unknown[]>;
    modalities?: Array<"text" | "image" | (string & {})>;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Non-streaming response
  // ═══════════════════════════════════════════════════════════════════════

  export interface ChatResponseChoice {
    finish_reason: ChatCompletionFinishReason | null;
    index: number;
    message: AssistantMessage;
    logprobs?: ChatMessageTokenLogprobs | null;
  }

  export interface ChatResponse {
    id: string;
    choices: ChatResponseChoice[];
    created: number;
    model: string;
    object: "chat.completion";
    system_fingerprint?: string | null;
    usage?: ChatGenerationTokenUsage;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Streaming response
  // ═══════════════════════════════════════════════════════════════════════

  export interface ChatStreamingMessageChunk {
    role?: "assistant";
    content?: string | null;
    reasoning?: string | null;
    refusal?: string | null;
    tool_calls?: ChatStreamingMessageToolCall[];
    reasoning_details?: ReasoningDetail[];
  }

  export interface ChatStreamingChoice {
    delta: ChatStreamingMessageChunk;
    finish_reason: ChatCompletionFinishReason | null;
    index: number;
    logprobs?: ChatMessageTokenLogprobs | null;
  }

  export interface ChatStreamingResponseChunk {
    data: {
      id: string;
      choices: ChatStreamingChoice[];
      created: number;
      model: string;
      object: "chat.completion.chunk";
      system_fingerprint?: string | null;
      error?: { message: string; code: number };
      usage?: ChatGenerationTokenUsage;
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Error response
  // ═══════════════════════════════════════════════════════════════════════

  export interface ChatError {
    error: {
      code: string | number | null;
      message: string;
      param?: string | null;
      type?: string | null;
    };
  }
}
