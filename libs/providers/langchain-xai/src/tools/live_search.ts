import type { XAISearchParameters, XAISearchSource } from "../live_search.js";

/**
 * xAI's deprecated live_search tool type.
 */
export const XAI_LIVE_SEARCH_TOOL_TYPE = "live_search_deprecated_20251215";
export const XAI_LIVE_SEARCH_TOOL_NAME = "live_search";

/**
 * xAI's built-in live_search tool type.
 * Enables the model to search the web for real-time information.
 */
export interface XAILiveSearchTool extends XAISearchParameters {
  /**
   * The name of the tool. Must be "live_search" for xAI's built-in search.
   */
  name: typeof XAI_LIVE_SEARCH_TOOL_NAME;
  /**
   * The type of the tool. This uses a deprecated Live Search API shape:
   * the advanced agentic search capabilities powering grok.com are generally
   * available in the new agentic tool calling API, and the Live Search API
   * will be deprecated by December 15, 2025.
   */
  type: typeof XAI_LIVE_SEARCH_TOOL_TYPE;
}

/**
 * Web search source configuration for the xAI live search tool (camelCase).
 * This is converted to the snake_case `XAIWebSource` internally.
 */
export interface XAIWebSearchToolSource {
  type: "web";
  country?: string;
  excludedWebsites?: string[];
  allowedWebsites?: string[];
  safeSearch?: boolean;
}

/**
 * News search source configuration for the xAI live search tool (camelCase).
 * This is converted to the snake_case `XAINewsSource` internally.
 */
export interface XAINewsSearchToolSource {
  type: "news";
  country?: string;
  excludedWebsites?: string[];
  safeSearch?: boolean;
}

/**
 * X (formerly Twitter) search source configuration for the xAI live search tool (camelCase).
 * This is converted to the snake_case `XAIXSource` internally.
 */
export interface XAIXSearchToolSource {
  type: "x";
  includedXHandles?: string[];
  excludedXHandles?: string[];
  postFavoriteCount?: number;
  postViewCount?: number;
}

/**
 * RSS feed search source configuration for the xAI live search tool.
 * The structure matches `XAIRssSource` (only `links`).
 */
export interface XAIRssSearchToolSource {
  type: "rss";
  links: string[];
}

export type XAISearchToolSource =
  | XAIWebSearchToolSource
  | XAINewsSearchToolSource
  | XAIXSearchToolSource
  | XAIRssSearchToolSource;

/**
 * Options for the xAI live search tool (camelCase).
 * All fields are camel-cased for the TypeScript API and are mapped to the
 * corresponding snake_case fields in the underlying `XAISearchParameters`
 * object that is sent to xAI's deprecated Live Search API.
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
   * These are converted to the snake_case `XAISearchSource` structures
   * used by the underlying xAI Live Search API.
   */
  sources?: XAISearchToolSource[];
}

function mapToolSourceToSearchSource(
  source: XAISearchToolSource
): XAISearchSource {
  switch (source.type) {
    case "web":
      return {
        type: "web",
        ...(source.country !== undefined && { country: source.country }),
        ...(source.allowedWebsites !== undefined && {
          allowed_websites: source.allowedWebsites,
        }),
        ...(source.excludedWebsites !== undefined && {
          excluded_websites: source.excludedWebsites,
        }),
        ...(source.safeSearch !== undefined && {
          safe_search: source.safeSearch,
        }),
      };
    case "news":
      return {
        type: "news",
        ...(source.country !== undefined && { country: source.country }),
        ...(source.excludedWebsites !== undefined && {
          excluded_websites: source.excludedWebsites,
        }),
        ...(source.safeSearch !== undefined && {
          safe_search: source.safeSearch,
        }),
      };
    case "x":
      return {
        type: "x",
        ...(source.includedXHandles !== undefined && {
          included_x_handles: source.includedXHandles,
        }),
        ...(source.excludedXHandles !== undefined && {
          excluded_x_handles: source.excludedXHandles,
        }),
        ...(source.postFavoriteCount !== undefined && {
          post_favorite_count: source.postFavoriteCount,
        }),
        ...(source.postViewCount !== undefined && {
          post_view_count: source.postViewCount,
        }),
      };
    case "rss":
      return {
        type: "rss",
        links: source.links,
      };
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
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
): XAILiveSearchTool {
  return {
    type: XAI_LIVE_SEARCH_TOOL_TYPE,
    name: XAI_LIVE_SEARCH_TOOL_NAME,
    mode: options?.mode,
    max_search_results: options?.maxSearchResults,
    from_date: options?.fromDate,
    to_date: options?.toDate,
    return_citations: options?.returnCitations,
    sources: options?.sources?.map(mapToolSourceToSearchSource),
  } satisfies XAILiveSearchTool;
}
