import type {
  BaseChatModelParams,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import type { OpenRouter } from "../api-types.js";

export type OpenRouterResponseFormat =
  OpenRouter.ChatGenerationParams["response_format"];

/**
 * Plugin configuration for OpenRouter plugins (e.g. web search).
 */
export interface OpenRouterPlugin {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Shared fields that can be set at construction time or overridden per-call.
 */
export interface ChatOpenRouterFields {
  /** Sampling temperature (0–2). */
  temperature?: number;
  /** Maximum number of tokens to generate. */
  maxTokens?: number;
  /** Nucleus sampling cutoff probability. */
  topP?: number;
  /** Top-K sampling: only consider the K most likely tokens. */
  topK?: number;
  /** Additive penalty based on how often a token has appeared so far (−2 to 2). */
  frequencyPenalty?: number;
  /** Additive penalty based on whether a token has appeared at all (−2 to 2). */
  presencePenalty?: number;
  /** Multiplicative penalty applied to repeated token logits (0 to 2). */
  repetitionPenalty?: number;
  /** Minimum probability threshold for token sampling. */
  minP?: number;
  /** Top-A sampling threshold. */
  topA?: number;
  /** Random seed for deterministic generation. */
  seed?: number;
  /** Stop sequences that halt generation. */
  stop?: string[];
  /** Token-level biases to apply during sampling. */
  logitBias?: Record<string, number>;
  /** Number of most-likely log-probabilities to return per token. */
  topLogprobs?: number;
  /** OpenRouter-specific transformations to apply to the request. */
  transforms?: string[];
  /** OpenRouter-specific list of models for routing. */
  models?: string[];
  /** OpenRouter-specific routing strategy. */
  route?: "fallback";
  /** OpenRouter-specific provider preferences and ordering. */
  provider?: OpenRouter.ProviderPreferences;
  /** OpenRouter plugins to enable (e.g. web search). */
  plugins?: OpenRouterPlugin[];
}

/**
 * Constructor parameters for `ChatOpenRouter`.
 */
export interface ChatOpenRouterParams
  extends BaseChatModelParams,
    ChatOpenRouterFields {
  /** Model identifier, e.g. "anthropic/claude-4-sonnet". */
  model?: string;
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
  /** Tool definitions to bind for this call. */
  tools?: BindToolsInput[];
  /** Response format constraint (text, JSON object, or JSON schema). */
  response_format?: OpenRouterResponseFormat;
  /** Whether tool schemas should use strict mode. */
  strict?: boolean;
  /** Predicted output content for latency optimization. */
  prediction?: { type: "content"; content: string };
  /** Stable identifier for end-users, used for abuse detection. */
  user?: string;
  /** Abort signal to cancel the request. */
  signal?: AbortSignal;
}
