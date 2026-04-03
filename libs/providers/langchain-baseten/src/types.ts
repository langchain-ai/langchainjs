import type { ChatOpenAIFields } from "@langchain/openai";

/**
 * Default base URL for Baseten's managed inference API.
 * Supports all open-source models hosted on Baseten's Model APIs.
 *
 * For self-deployed models, override with the model-specific URL:
 * `https://model-{model_id}.api.baseten.co/v1`
 */
export const DEFAULT_BASE_URL = "https://inference.baseten.co/v1";

/**
 * Default environment variable name for the Baseten API key.
 */
export const DEFAULT_API_KEY_ENV_VAR = "BASETEN_API_KEY";

/**
 * Normalize a dedicated model URL to OpenAI-compatible `/sync/v1` format.
 *
 * Baseten dedicated model endpoints come in several forms:
 * - `.../predict` -> converted to `.../sync/v1`
 * - `.../sync` -> appended with `/v1`
 * - anything else -> ensures trailing `/v1`
 *
 * See: Python `langchain-baseten._normalize_model_url`
 */
export function normalizeModelUrl(url: string): string {
  if (url.endsWith("/predict")) {
    return `${url.slice(0, -"/predict".length)}/sync/v1`;
  }
  if (url.endsWith("/sync")) {
    return `${url}/v1`;
  }
  if (!url.endsWith("/v1")) {
    let trimmed = url;
    while (trimmed.endsWith("/")) {
      trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed}/v1`;
  }
  return url;
}

/**
 * Input fields for constructing a `ChatBaseten` instance.
 *
 * Extends `ChatOpenAIFields` since Baseten exposes an OpenAI-compatible API.
 * The API key defaults to the `BASETEN_API_KEY` environment variable and
 * the base URL defaults to Baseten's managed inference endpoint.
 *
 * @example
 * ```typescript
 * const input: BasetenChatInput = {
 *   model: "deepseek-ai/DeepSeek-V3.1",
 *   // apiKey defaults to process.env.BASETEN_API_KEY
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Self-deployed model via dedicated URL
 * const input: BasetenChatInput = {
 *   modelUrl: "https://model-abc123.api.baseten.co/environments/production/predict",
 *   basetenApiKey: "my-key",
 * };
 * ```
 */
export interface BasetenChatInput extends Omit<ChatOpenAIFields, "model"> {
  /**
   * Baseten model slug in `org/model-name` format.
   * Optional when `modelUrl` is provided (the model ID will be
   * extracted from the URL).
   *
   * @example "deepseek-ai/DeepSeek-V3.1"
   * @example "zai-org/GLM-5"
   * @example "moonshotai/Kimi-K2.5"
   */
  model?: string;

  /**
   * Dedicated model URL for self-deployed Baseten models.
   * Supports `/predict`, `/sync`, and `/sync/v1` endpoint formats;
   * the URL is automatically normalized to `/sync/v1`.
   *
   * When provided, overrides `baseURL`.
   *
   * @example "https://model-abc123.api.baseten.co/environments/production/predict"
   */
  modelUrl?: string;

  /**
   * Baseten API key. If not provided, falls back to the `BASETEN_API_KEY`
   * environment variable.
   */
  basetenApiKey?: string;

  /**
   * Override the base URL for Baseten's API.
   * Defaults to `https://inference.baseten.co/v1`.
   *
   * Set this for self-deployed models:
   * `https://model-{model_id}.api.baseten.co/v1`
   */
  baseURL?: string;
}
