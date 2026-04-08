import type { ChatOpenAIFields } from "@langchain/openai";

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
