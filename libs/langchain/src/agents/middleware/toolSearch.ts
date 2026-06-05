import type {
  StructuredToolInterface,
  ClientTool,
  ServerTool,
} from "@langchain/core/tools";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { createMiddleware } from "../middleware.js";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import type {
  ChatModelProvider,
  ConfigurableModel,
} from "../../chat_models/universal.js";

type ToolName = string;
export type ToolIdentifier =
  | (ToolName | StructuredToolInterface)[];

export type ToolSearchMiddlewareConfig = {
  /**
   * Which tools to are deferred; withheld from the model until its tool search surfaces them.
   *
   * Tools already constructed with `extras.defer_loading === true` are deferred
   * regardless of this option; if `searchableTools` is omitted, only those pre-marked
   * tools are deferred.
   */
  searchableTools?: ToolIdentifier;
};

type ServerSearchCapableProvider = Extract<
  ChatModelProvider,
  "anthropic" | "openai"
>;
type DetectedProvider = ServerSearchCapableProvider | "other";

/**
 * Provider-side tool search middleware.
 *
 * Leverages server-side tool search: the full client tool
 * catalog is forwarded to the provider with `config.searchableTools` marked
 * `defer_loading`, and the provider discloses them on demand via its own search.
 *
 * Requires a model with server-side tool search support: OpenAI gpt-5.4+ or Anthropic
 * Claude Sonnet 4+/Opus 4+/Haiku 4.5+. Non-Anthropic/OpenAI providers throw; an
 * in-family model that is too old surfaces the provider's own API error rather
 * than being gated here.
 * 
 * @example
 * ```ts
 * import { createAgent, toolSearchMiddleware } from "langchain";
 * import { ChatAnthropic } from "@langchain/anthropic";
 *
 * const agent = createAgent({
 *   model: new ChatAnthropic({ model: "claude-sonnet-4-5" }),
 *   tools: [getWeather, ...nicheTools],
 *   middleware: [
 *     // Defer the niche tools behind the provider's tool search; the model
 *     // discovers them on demand instead of receiving every schema up front.
 *     toolSearchMiddleware({ searchableTools: nicheTools }),
 *   ],
 * });
 * ```
 * 
 * @example
 * import { tool } from "@langchain/core/tools";
 * import { createAgent, toolSearchMiddleware } from "langchain";
 * import { ChatAnthropic } from "@langchain/anthropic";
 *
 * // A tool marked `defer_loading` at construction is deferred on its own —
 * // no need to list it in `searchableTools`; the middleware honors the flag.
 * const sendEmail = tool(sendEmailFn, {
 *   name: "send_email",
 *   description: "Send an email",
 *   schema: sendEmailSchema,
 *   extras: { defer_loading: true },
 * });
 *
 * const agent = createAgent({
 *   model: new ChatAnthropic({ model: "claude-sonnet-4-5" }),
 *   tools: [getWeather, sendEmail],
 *   middleware: [toolSearchMiddleware()],
 * });
 * ```
 *
 * @param config - Configuration options for the middleware
 * @param config.searchableTools - Tools to defer behind tool search
 * @returns A middleware instance that can be used with `createAgent`
 * @public
 */
export function providerToolSearchMiddleware(config: ToolSearchMiddlewareConfig = {}) {
  const deferNames = toToolNames(config.searchableTools);

  return createMiddleware({
    name: "ToolSearch",
    wrapModelCall: (request, handler) => {
      const tools = request.tools ?? [];
      const provider = getModelProvider(request.model);

      if (!supportsProviderToolSearch(provider)) {
        throw new Error(
          `toolSearchMiddleware requires a provider with server-side tool search, but got ${provider}`
        );
      }

      /**
       * For each tool we want to defer, emit a minimal binding spec (`StructuredToolParams`)
       * carrying `defer_loading`. 
       */
      const boundTools = tools.map((tool) => deferToolIfNeeded(tool, deferNames));

      const nativeSearchTool = createServerToolSearchTool(provider);
      return handler({ ...request, tools: [...boundTools, nativeSearchTool] });
    },
  });
}

/**
 * If a tool should be deferred, return a minimal binding spec
 * (`StructuredToolParams`) carrying `defer_loading`; otherwise return it as-is.
 */
function deferToolIfNeeded(
  tool: ClientTool | ServerTool,
  deferNames: Set<string>
): ClientTool | ServerTool {
  if (!isLangChainTool(tool)) return tool;
  const shouldDefer =
    tool.extras?.defer_loading === true || deferNames.has(tool.name);
  if (!shouldDefer) return tool;
  return {
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    extras: { ...tool.extras, defer_loading: true },
  };
}

/** Flatten a list of tool names/instances into a set of tool names. */
function toToolNames(tools: ToolIdentifier = []): Set<string> {
  return new Set(tools.map((t) => (typeof t === "string" ? t : t.name)));
}

function getModelProvider(model: LanguageModelLike): DetectedProvider {
  const name = model.getName();
  const configured =
    name === "ConfigurableModel"
      ? (model as ConfigurableModel)._defaultConfig?.modelProvider
      : undefined;
  if (name === "ChatAnthropic" || configured === "anthropic")
    return "anthropic";
  if (name === "ChatOpenAI" || configured === "openai") return "openai";
  return "other";
}

function supportsProviderToolSearch(
  provider: DetectedProvider
): provider is ServerSearchCapableProvider {
  return ["anthropic", "openai"].includes(provider);
}

function createServerToolSearchTool(provider: ServerSearchCapableProvider) {
  switch (provider) {
    case "anthropic":
      return {
        type: "tool_search_tool_bm25_20251119",
        name: "tool_search_tool_bm25",
      };
    case "openai":
      return { type: "tool_search" };
    default: {
      // This should never happen
      const _exhaustive: never = provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}
