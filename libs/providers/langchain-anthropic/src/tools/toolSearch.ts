import Anthropic from "@anthropic-ai/sdk";
import { type ServerTool } from "@langchain/core/tools";

/**
 * Options for the tool search tool.
 */
export interface ToolSearchOptions {
  /**
   * Create a cache control breakpoint at this content block.
   */
  cacheControl?: Anthropic.Beta.BetaCacheControlEphemeral;
}

/**
 * Creates a regex-based tool search tool that enables Claude to work with hundreds
 * or thousands of tools by dynamically discovering and loading them on-demand.
 * Claude constructs regex patterns (using Python's `re.search()` syntax) to search
 * for tools by name, description, argument names, and argument descriptions.
 *
 * @note This tool requires the beta header `advanced-tool-use-2025-11-20` in API requests.
 *
 * @see {@link https://docs.anthropic.com/en/docs/build-with-claude/tool-use/tool-search-tool | Anthropic Tool Search Documentation}
 * @param options - Configuration options for the tool search tool
 * @returns A tool search tool definition to be passed to the Anthropic API
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 *
 * const model = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 * });
 *
 * const getWeather = tool(
 *   async (input: { location: string }) => {
 *     return `Weather in ${input.location}`;
 *   },
 *   {
 *     name: "get_weather",
 *     description: "Get the weather at a specific location",
 *     schema: z.object({
 *       location: z.string(),
 *     }),
 *     extras: { defer_loading: true },
 *   },
 * );
 *
 * // Use with deferred tools - Claude will search and discover tools as needed
 * const response = await model.invoke("What is the weather in San Francisco?", {
 *   tools: [
 *     tools.toolSearchRegex_20251119(),
 *     getWeather,
 *   ],
 * });
 * ```
 */
export function toolSearchRegex_20251119(
  options?: ToolSearchOptions
): ServerTool {
  return {
    type: "tool_search_tool_regex_20251119",
    name: "tool_search_tool_regex",
    cache_control: options?.cacheControl,
  } satisfies Anthropic.Beta.Messages.BetaToolSearchToolRegex20251119;
}

/**
 * Creates a BM25-based tool search tool that enables Claude to work with hundreds
 * or thousands of tools by dynamically discovering and loading them on-demand.
 * Claude uses natural language queries to search for tools by name, description,
 * argument names, and argument descriptions.
 *
 * @note This tool requires the beta header `advanced-tool-use-2025-11-20` in API requests.
 *
 * @see {@link https://docs.anthropic.com/en/docs/build-with-claude/tool-use/tool-search-tool | Anthropic Tool Search Documentation}
 * @param options - Configuration options for the tool search tool
 * @returns A tool search tool definition to be passed to the Anthropic API
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 *
 * const model = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 *   clientOptions: {
 *     defaultHeaders: { "anthropic-beta": "advanced-tool-use-2025-11-20" },
 *   },
 * });
 *
 * const getWeather = tool(
 *   async (input: { location: string }) => {
 *     return `Weather in ${input.location}`;
 *   },
 *   {
 *     name: "get_weather",
 *     description: "Get the weather at a specific location",
 *     schema: z.object({
 *       location: z.string(),
 *     }),
 *     extras: { defer_loading: true },
 *   },
 * );
 *
 * // Use with deferred tools - Claude will search using natural language
 * const response = await model.invoke("What is the weather in San Francisco?", {
 *   tools: [
 *     tools.toolSearchBM25_20251119(),
 *     getWeather,
 *   ],
 * });
 * ```
 */
export function toolSearchBM25_20251119(
  options?: ToolSearchOptions
): ServerTool {
  return {
    type: "tool_search_tool_bm25_20251119",
    name: "tool_search_tool_bm25",
    cache_control: options?.cacheControl,
  } satisfies Anthropic.Beta.Messages.BetaToolSearchToolBm25_20251119;
}
