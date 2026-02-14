import type {
  BaseChatModelParams,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import type { OpenRouter } from "../api-types.js";

/**
 * Response format types for the `response_format` call option.
 */
export type OpenRouterResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | OpenRouter.ResponseFormatJSONSchema
  | OpenRouter.ResponseFormatTextGrammar;

/**
 * Plugin configuration for OpenRouter plugins (e.g. web search).
 */
export interface OpenRouterPlugin {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Full request body sent to the OpenRouter API.
 *
 * Extends the generated `ChatGenerationParams` with additional
 * OpenRouter-specific fields not yet in the OpenAPI spec.
 */
export type OpenRouterRequestBody = OpenRouter.ChatGenerationParams & {
  top_k?: number | null;
  repetition_penalty?: number | null;
  min_p?: number | null;
  top_a?: number | null;
  prediction?: { type: "content"; content: string };
};

/**
 * Shared fields that can be set at construction time or overridden per-call.
 */
export interface ChatOpenRouterFields {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  minP?: number;
  topA?: number;
  seed?: number;
  stop?: string[];
  logitBias?: Record<string, number>;
  topLogprobs?: number;
  /** OpenRouter-specific: transformations to apply to the request. */
  transforms?: string[];
  /** OpenRouter-specific: list of models for routing. */
  models?: string[];
  /** OpenRouter-specific: routing strategy. */
  route?: "fallback";
  /** OpenRouter-specific: provider preferences / ordering. */
  provider?: OpenRouter.ProviderPreferences;
  /** OpenRouter-specific: plugins to enable (e.g. web search). */
  plugins?: OpenRouterPlugin[];
}

/**
 * Constructor parameters for `ChatOpenRouter`.
 */
export interface ChatOpenRouterInput
  extends BaseChatModelParams,
    ChatOpenRouterFields {
  /** Model identifier, e.g. "anthropic/claude-4-sonnet". */
  model: string;
  /** OpenRouter API key. Falls back to `OPENROUTER_API_KEY` env var. */
  apiKey?: string;
  /** Base URL for the API. Defaults to "https://openrouter.ai/api/v1". */
  baseURL?: string;
  /** Your site URL — used for OpenRouter rankings / rate limits. */
  siteUrl?: string;
  /** Your site name — shown on the OpenRouter leaderboard. */
  siteName?: string;
  /** Stable identifier for end-users, used for abuse detection. */
  user?: string;
  /** Extra params passed through to the API body. */
  modelKwargs?: Record<string, unknown>;
  /** Whether to include usage in streaming chunks. Defaults to true. */
  streamUsage?: boolean;
}

/**
 * Per-call options for `ChatOpenRouter`.
 */
export interface ChatOpenRouterCallOptions
  extends BaseChatModelCallOptions,
    ChatOpenRouterFields {
  tools?: BindToolsInput[];
  response_format?: OpenRouterResponseFormat;
  /** Whether tool schemas should use strict mode. */
  strict?: boolean;
  /** Predicted output content for latency optimization. */
  prediction?: { type: "content"; content: string };
  /** Stable identifier for end-users, used for abuse detection. */
  user?: string;
  signal?: AbortSignal;
}
