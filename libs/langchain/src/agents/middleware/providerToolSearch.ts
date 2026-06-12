import type {
  StructuredToolInterface,
  StructuredToolParams,
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
export type ToolIdentifier = ToolName | StructuredToolInterface;

export type ProviderToolSearchMiddlewareConfig = {
  /**
   * Which tools are deferred; withheld from the model until its tool search surfaces them.
   *
   * Tools already constructed with `extras.defer_loading === true` are deferred
   * regardless of this option; if `searchableTools` is omitted, only those pre-marked
   * tools are deferred.
   */
  searchableTools?: ToolIdentifier[];
};

const SERVER_SEARCH_PROVIDERS = [
  "anthropic",
  "openai",
] as const satisfies readonly ChatModelProvider[];

type ServerSearchCapableProvider = (typeof SERVER_SEARCH_PROVIDERS)[number];
type DetectedProvider = ServerSearchCapableProvider | "other";

type ServerToolSearchTool = { type: string; name?: string };

const SERVER_TOOL_SEARCH_TOOLS = {
  anthropic: {
    type: "tool_search_tool_bm25_20251119",
    name: "tool_search_tool_bm25",
  },
  openai: { type: "tool_search" },
} as const satisfies Record<ServerSearchCapableProvider, ServerToolSearchTool>;

/**
 * Provider-side tool search middleware.
 *
 * Leverages server-side tool search: the full client tool catalog is forwarded
 * to the provider, with deferred tools marked `defer_loading` so the provider
 * discloses them on demand via its own search. A tool is deferred when it is
 * named in `searchableTools` or built with `extras.defer_loading: true`.
 *
 * Requires a model with server-side tool search support: OpenAI gpt-5.4+ or Anthropic
 * Claude Sonnet 4+/Opus 4+/Haiku 4.5+. Non-Anthropic/OpenAI providers throw; an
 * in-family model that is too old surfaces the provider's own API error rather
 * than being gated here.
 *
 * @example
 * ```ts
 * import { createAgent, providerToolSearchMiddleware } from "langchain";
 * import { ChatAnthropic } from "@langchain/anthropic";
 *
 * const agent = createAgent({
 *   model: new ChatAnthropic({ model: "claude-sonnet-4-5" }),
 *   tools: [getWeather, ...nicheTools],
 *   middleware: [
 *     // Defer the niche tools behind the provider's tool search; the model
 *     // discovers them on demand instead of receiving every schema up front.
 *     providerToolSearchMiddleware({ searchableTools: nicheTools }),
 *   ],
 * });
 * ```
 *
 * @example
 * ```ts
 * import { tool } from "@langchain/core/tools";
 * import { createAgent, providerToolSearchMiddleware } from "langchain";
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
 *   middleware: [providerToolSearchMiddleware()],
 * });
 * ```
 *
 * @param config - Configuration options for the middleware
 * @param config.searchableTools - Tools to defer behind tool search
 * @returns A middleware instance that can be used with `createAgent`
 */
export function providerToolSearchMiddleware(
  config: ProviderToolSearchMiddlewareConfig = {}
) {
  const deferNames = toToolNames(config.searchableTools);

  return createMiddleware({
    name: "ProviderToolSearch",
    wrapModelCall: (request, handler) => {
      const tools = request.tools ?? [];

      // Fail fast if we try to defer a tool that is not bound to the model
      if (deferNames.size > 0) {
        const available = tools.filter(isLangChainTool).map((t) => t.name);
        const unknown = [...deferNames].filter(
          (name) => !available.includes(name)
        );
        if (unknown.length > 0) {
          throw new Error(
            `providerToolSearchMiddleware: searchableTools references tool(s) not bound to the model: ${unknown.join(", ")}`
          );
        }
      }

      const provider = getModelProvider(request.model);
      if (!supportsProviderToolSearch(provider)) {
        throw new Error(
          `providerToolSearchMiddleware requires a provider with server-side tool search, but got ${provider}`
        );
      }

      // Nothing to defer -> pass thru
      if (!hasDeferredTools(tools, deferNames)) return handler(request);

      // For each deferred tool, emit a minimal binding spec carrying `defer_loading`.
      const boundTools = tools.map((tool) =>
        deferToolIfNeeded(tool, deferNames)
      );

      const nativeSearchTool = SERVER_TOOL_SEARCH_TOOLS[provider];
      return handler({ ...request, tools: [...boundTools, nativeSearchTool] });
    },
  });
}

function isDeferred(
  tool: unknown,
  deferNames: Set<string>
): tool is StructuredToolParams {
  return (
    isLangChainTool(tool) &&
    (tool.extras?.defer_loading === true || deferNames.has(tool.name))
  );
}

function hasDeferredTools(
  tools: readonly (ClientTool | ServerTool)[],
  deferNames: Set<string>
): boolean {
  return tools.some((tool) => isDeferred(tool, deferNames));
}

/**
 * If a tool should be deferred, return a minimal binding spec carrying `defer_loading`.
 * Otherwise return it as-is
 */
function deferToolIfNeeded(
  tool: ClientTool | ServerTool,
  deferNames: Set<string>
): ClientTool | ServerTool {
  if (!isDeferred(tool, deferNames)) return tool;
  return {
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    extras: { ...tool.extras, defer_loading: true },
  };
}

/** Flatten a list of tool names/instances into a set of tool names. */
function toToolNames(tools: ToolIdentifier[] = []): Set<string> {
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
  return (SERVER_SEARCH_PROVIDERS as readonly string[]).includes(provider);
}
