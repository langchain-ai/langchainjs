import type { ClientTool, ServerTool } from "@langchain/core/tools";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import type { AgentLanguageModelLike as LanguageModelLike } from "../model.js";
import {
  initChatModel,
  type ConfigurableModel,
} from "../../chat_models/universal.js";
import { createMiddleware } from "../middleware.js";

type BuiltinToolProvider = "anthropic" | "openai" | "google";

/**
 * Provider built-in tools are plain records and are only accepted by the provider
 * that defines them. OpenAI Responses built-ins are `{ type: <name> }` entries, with
 * dated variants (`web_search_preview_2025_03_11`); Anthropic tools carry a dated
 * `type` (`web_search_20250305`) plus a few undated ones; Gemini built-ins are keyed
 * payloads (`{ google_search: {} }`) in either snake or camel case. Client tools and
 * plain function payloads match none of these shapes and are never dropped.
 */
const OPENAI_BUILTIN_TOOL_TYPES = [
  "apply_patch",
  "code_interpreter",
  "computer_use_preview",
  "file_search",
  "image_generation",
  "local_shell",
  "mcp",
  "shell",
  "tool_search",
  "web_search",
  "web_search_preview",
];
const ANTHROPIC_BUILTIN_TOOL_TYPES = new Set([
  "mcp_toolset",
  "tool_search_tool_bm25",
  "tool_search_tool_regex",
]);
const ANTHROPIC_DATED_BUILTIN_TOOL_TYPE = /_\d{8}$/;
const GOOGLE_BUILTIN_TOOL_KEYS = new Set([
  "codeexecution",
  "computeruse",
  "enterprisewebsearch",
  "filesearch",
  "googlemaps",
  "googlesearch",
  "googlesearchretrieval",
  "urlcontext",
]);

/** Fold a Gemini tool key so snake and camel spellings compare equal. */
function normalizeKey(key: string): string {
  return key.replaceAll("_", "").toLowerCase();
}

function getModelProvider(
  model: LanguageModelLike
): BuiltinToolProvider | undefined {
  const name = model.getName();
  const configured =
    name === "ConfigurableModel"
      ? (model as ConfigurableModel)._defaultConfig?.modelProvider
      : undefined;
  if (name === "ChatAnthropic" || configured === "anthropic")
    return "anthropic";
  if (
    name === "ChatOpenAI" ||
    name === "AzureChatOpenAI" ||
    configured === "openai" ||
    configured === "azure_openai"
  )
    return "openai";
  if (
    name === "ChatGoogleGenerativeAI" ||
    name === "ChatVertexAI" ||
    configured === "google_genai" ||
    configured === "google_vertexai"
  )
    return "google";
  return undefined;
}

/**
 * The provider that defines this built-in tool, or `undefined` for client tools.
 *
 * Anthropic is matched before OpenAI: `tool_search_tool_bm25_20251119` would also
 * match the `tool_search` prefix, and `web_search_20250305` the `web_search` one.
 */
function getBuiltinToolProvider(
  tool: ClientTool | ServerTool
): BuiltinToolProvider | undefined {
  if (isLangChainTool(tool)) return undefined;
  const payload = tool as Record<string, unknown>;
  const type = payload.type;
  if (typeof type === "string") {
    if (
      ANTHROPIC_BUILTIN_TOOL_TYPES.has(type) ||
      ANTHROPIC_DATED_BUILTIN_TOOL_TYPE.test(type)
    )
      return "anthropic";
    if (
      OPENAI_BUILTIN_TOOL_TYPES.some(
        (name) => type === name || type.startsWith(`${name}_`)
      )
    )
      return "openai";
    return undefined;
  }
  // A payload mixing built-ins with `functionDeclarations` keeps its function tools
  // rather than being dropped whole, so every key must be a built-in to qualify.
  const keys = Object.keys(payload);
  if (
    keys.length > 0 &&
    keys.every((key) => GOOGLE_BUILTIN_TOOL_KEYS.has(normalizeKey(key)))
  )
    return "google";
  return undefined;
}

/**
 * Drop built-in tools the fallback model's provider does not define.
 *
 * An unrecognized fallback provider drops them too: a built-in tool only exists
 * on its own provider's API, so losing the capability on a retry beats failing
 * the retry outright on an unknown tool type.
 */
function withoutForeignBuiltinTools(
  tools: readonly (ClientTool | ServerTool)[] | undefined,
  model: LanguageModelLike
): (ClientTool | ServerTool)[] | undefined {
  if (!tools?.length) return tools as (ClientTool | ServerTool)[] | undefined;

  const provider = getModelProvider(model);
  const kept = tools.filter((tool) => {
    const owner = getBuiltinToolProvider(tool);
    return owner === undefined || owner === provider;
  });
  if (kept.length === tools.length) return tools as (ClientTool | ServerTool)[];

  console.warn(
    `modelFallbackMiddleware: dropped ${
      tools.length - kept.length
    } provider built-in tool(s) not supported by fallback model ${model.getName()}`
  );
  return kept;
}

/**
 * Middleware that provides automatic model fallback on errors.
 *
 * This middleware attempts to retry failed model calls with alternative models
 * in sequence. When a model call fails, it tries the next model in the fallback
 * list until either a call succeeds or all models have been exhausted.
 *
 * @example
 * ```ts
 * import { createAgent, modelFallbackMiddleware } from "langchain";
 *
 * // Create middleware with fallback models (not including primary)
 * const fallback = modelFallbackMiddleware(
 *   "openai:gpt-4o-mini",  // First fallback
 *   "anthropic:claude-sonnet-4-5-20250929",  // Second fallback
 * );
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",  // Primary model
 *   middleware: [fallback],
 *   tools: [],
 * });
 *
 * // If gpt-4o fails, automatically tries gpt-4o-mini, then claude
 * const result = await agent.invoke({
 *   messages: [{ role: "user", content: "Hello" }]
 * });
 * ```
 *
 * @param fallbackModels - The fallback models to try, in order.
 * @returns A middleware instance that handles model failures with fallbacks
 */
export function modelFallbackMiddleware(
  /**
   * The fallback models to try, in order.
   */
  ...fallbackModels: (string | LanguageModelLike)[]
) {
  return createMiddleware({
    name: "modelFallbackMiddleware",
    wrapModelCall: async (request, handler) => {
      /**
       * Try the primary model first
       */
      try {
        return await handler(request);
      } catch (error) {
        /**
         * If primary model fails, try fallback models in sequence
         */
        for (let i = 0; i < fallbackModels.length; i++) {
          try {
            const fallbackModel = fallbackModels[i];
            const model =
              typeof fallbackModel === "string"
                ? await initChatModel(fallbackModel)
                : fallbackModel;

            console.warn(
              `modelFallbackMiddleware: model call failed (${
                error instanceof Error ? error.name : typeof error
              }); retrying with fallback model ${model.getName()}`
            );

            return await handler({
              ...request,
              model,
              tools: withoutForeignBuiltinTools(request.tools, model),
            });
          } catch (fallbackError) {
            /**
             * If this is the last fallback, throw the error
             */
            if (i === fallbackModels.length - 1) {
              throw fallbackError;
            }
            // Otherwise, continue to next fallback
          }
        }
        /**
         * If no fallbacks were provided, re-throw the original error
         */
        throw error;
      }
    },
  });
}
