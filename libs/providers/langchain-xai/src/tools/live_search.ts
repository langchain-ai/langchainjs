import { tool } from "@langchain/core/tools";
import type { DynamicStructuredTool, ToolRuntime } from "@langchain/core/tools";
import type { XAISearchParameters, XAISearchSource } from "../live_search.js";

/**
 * xAI's built-in live_search tool type.
 * Enables the model to search the web for real-time information.
 */
export interface XAILiveSearchTool extends XAISearchParameters {
  /**
   * The type of the tool. Must be "live_search" for xAI's built-in search.
   */
  type: "live_search";
}

/**
 * Options for the xAI live search tool (camelCase).
 * These are converted to the snake_case `XAISearchParameters` used internally.
 */
export interface XAILiveSearchToolOptions {
  /**
   * Controls when the model should perform a search.
   * - "auto": Let the model decide when to search (default)
   * - "on": Always search for every request
   * - "off": Never search
   */
  mode?: "auto" | "on" | "off";
  /**
   * Maximum number of search results to return.
   * @default 20
   */
  maxSearchResults?: number;
  /**
   * Filter search results to only include content from after this date.
   * Format: ISO 8601 date string (e.g., "2024-01-01")
   */
  fromDate?: string;
  /**
   * Filter search results to only include content from before this date.
   * Format: ISO 8601 date string (e.g., "2024-12-31")
   */
  toDate?: string;
  /**
   * Whether to return citations/sources for the search results.
   * @default true
   */
  returnCitations?: boolean;
  /**
   * Specific web/news/X/RSS sources that can be used for the search.
   * These use the same structure as `XAISearchSource` (snake_case fields)
   * since they are passed directly to the JSON API.
   */
  sources?: XAISearchSource[];
}

/**
 * Creates an xAI built-in live search tool.
 * Enables the model to search the web for real-time information.
 *
 * This tool is executed server-side by the xAI API.
 *
 * @example
 * ```typescript
 * import { ChatXAI, tools } from "@langchain/xai";
 *
 * const llm = new ChatXAI({
 *   model: "grok-beta",
 * });
 *
 * const searchTool = tools.xaiLiveSearch({
 *   maxSearchResults: 5,
 *   fromDate: "2024-01-01",
 *   returnCitations: true
 * });
 *
 * const llmWithSearch = llm.bindTools([searchTool]);
 * const result = await llmWithSearch.invoke("What happened in tech today?");
 * ```
 */
export function xaiLiveSearch(
  options: XAILiveSearchToolOptions = {}
): DynamicStructuredTool {
  const name = "live_search";

  const searchParams: XAISearchParameters = {
    ...(options.mode !== undefined && { mode: options.mode }),
    ...(options.maxSearchResults !== undefined && {
      max_search_results: options.maxSearchResults,
    }),
    ...(options.fromDate !== undefined && { from_date: options.fromDate }),
    ...(options.toDate !== undefined && { to_date: options.toDate }),
    ...(options.returnCitations !== undefined && {
      return_citations: options.returnCitations,
    }),
    ...(options.sources !== undefined && { sources: options.sources }),
  };

  const searchTool = tool(
    (async () => {
      // This is a server-side tool; the actual search is executed by xAI
      // based on the `search_parameters` we send via the ChatXAI provider.
      return "This tool is executed server-side by xAI.";
    }) as (
      input: unknown,
      runtime: ToolRuntime<unknown, unknown>
    ) => string | Promise<string>,
    {
      name,
      description: "Search the web for real-time information.",
      schema: {
        type: "object",
        properties: {},
      },
    }
  );

  searchTool.extras = {
    ...(searchTool.extras ?? {}),
    providerToolDefinition: {
      type: "live_search",
      ...searchParams,
    },
  };

  return searchTool;
}
