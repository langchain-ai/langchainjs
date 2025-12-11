/**
 * Web search source configuration for xAI Live Search.
 * Corresponds to a `{"type": "web", ...}` entry in `search_parameters.sources`.
 */
export interface XAIWebSource {
  type: "web";
  /**
   * Optional ISO alpha-2 country code used to bias results
   * towards a specific country/region.
   */
  country?: string;
  /**
   * Websites that should be excluded from the search results.
   * Maximum of 5 entries.
   */
  excluded_websites?: string[];
  /**
   * Websites that should be exclusively included in the search results.
   * Maximum of 5 entries.
   */
  allowed_websites?: string[];
  /**
   * Whether to enable safe search filtering for this source.
   */
  safe_search?: boolean;
}

/**
 * News search source configuration for xAI Live Search.
 * Corresponds to a `{"type": "news", ...}` entry in `search_parameters.sources`.
 */
export interface XAINewsSource {
  type: "news";
  /**
   * Optional ISO alpha-2 country code used to bias results
   * towards a specific country/region.
   */
  country?: string;
  /**
   * Websites that should be excluded from the search results.
   * Maximum of 5 entries.
   */
  excluded_websites?: string[];
  /**
   * Whether to enable safe search filtering for this source.
   */
  safe_search?: boolean;
}

/**
 * X (formerly Twitter) search source configuration for xAI Live Search.
 * Corresponds to a `{"type": "x", ...}` entry in `search_parameters.sources`.
 */
export interface XAIXSource {
  type: "x";
  /**
   * X handles that should be explicitly included in the search.
   * Maximum of 10 entries.
   */
  included_x_handles?: string[];
  /**
   * X handles that should be excluded from the search.
   * Maximum of 10 entries.
   */
  excluded_x_handles?: string[];
  /**
   * Minimum number of favorites a post must have to be included.
   */
  post_favorite_count?: number;
  /**
   * Minimum number of views a post must have to be included.
   */
  post_view_count?: number;
}

/**
 * RSS feed search source configuration for xAI Live Search.
 * Corresponds to a `{"type": "rss", ...}` entry in `search_parameters.sources`.
 */
export interface XAIRssSource {
  type: "rss";
  /**
   * Links to RSS feeds to be used as a data source.
   * The API currently expects a single URL.
   */
  links: string[];
}

export type XAISearchSource =
  | XAIWebSource
  | XAINewsSource
  | XAIXSource
  | XAIRssSource;

/**
 * Search parameters for xAI's Live Search API.
 * Controls how the model searches for and retrieves real-time information.
 *
 * @note The Live Search API is being deprecated by xAI in favor of
 * the agentic tool calling approach. Consider using `tools: [{ type: "live_search" }]`
 * for future compatibility.
 */
export interface XAISearchParameters {
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
  max_search_results?: number;
  /**
   * Filter search results to only include content from after this date.
   * Format: ISO 8601 date string (e.g., "2024-01-01")
   */
  from_date?: string;
  /**
   * Filter search results to only include content from before this date.
   * Format: ISO 8601 date string (e.g., "2024-12-31")
   */
  to_date?: string;
  /**
   * Whether to return citations/sources for the search results.
   * @default true
   */
  return_citations?: boolean;
  /**
   * Specific web/news/X/RSS sources that can be used for the search.
   * Each entry corresponds to a `{"type": "...", ...}` object in
   * `search_parameters.sources` as documented in the xAI Live Search docs.
   *
   * If omitted, xAI will default to enabling `web`, `news` and `x` sources.
   */
  sources?: XAISearchSource[];
}

/**
 * Concrete payload shape sent as `search_parameters` to the xAI API.
 */
export interface XAISearchParametersPayload {
  mode: "auto" | "on" | "off";
  max_search_results?: number;
  from_date?: string;
  to_date?: string;
  return_citations?: boolean;
  sources?: XAISearchSource[];
}

/**
 * Merge search parameters from instance defaults, tool definition
 * and per-call overrides.
 *
 * Precedence (lowest → highest):
 *   1. tool-level configuration (e.g. from xaiLiveSearch)
 *   2. instance-level defaults
 *   3. per-call overrides passed via `searchParameters`
 */
export function mergeSearchParams(
  instanceParams?: XAISearchParameters,
  callParams?: XAISearchParameters,
  toolParams?: XAISearchParameters
): XAISearchParameters | undefined {
  if (!instanceParams && !callParams && !toolParams) {
    return undefined;
  }

  return {
    ...(toolParams ?? {}),
    ...(instanceParams ?? {}),
    ...(callParams ?? {}),
  };
}

/**
 * Build the `search_parameters` payload to send to the xAI API
 * from high-level `XAISearchParameters`.
 */
export function buildSearchParametersPayload(
  params?: XAISearchParameters
): XAISearchParametersPayload | undefined {
  if (!params) {
    return undefined;
  }

  const payload: XAISearchParametersPayload = {
    mode: params.mode ?? "auto",
  };

  if (params.max_search_results !== undefined) {
    payload.max_search_results = params.max_search_results;
  }
  if (params.from_date !== undefined) {
    payload.from_date = params.from_date;
  }
  if (params.to_date !== undefined) {
    payload.to_date = params.to_date;
  }
  if (params.return_citations !== undefined) {
    payload.return_citations = params.return_citations;
  }
  if (params.sources && params.sources.length > 0) {
    payload.sources = params.sources;
  }

  return payload;
}

/**
 * Filter out xAI built-in tools (like `live_search`) from a tools array.
 * Used before sending the request to the xAI API, since built-in tools
 * are controlled via `search_parameters` instead.
 */
export function filterXAIBuiltInTools<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends { [key: string]: any }
>(payload?: { tools?: T[]; excludedTypes?: string[] }): T[] | undefined {
  if (!payload?.tools) {
    return undefined;
  }

  const filtered = payload.tools.filter((tool) => {
    if (tool == null || typeof tool !== "object") {
      return true;
    }

    if (!("type" in tool)) {
      return true;
    }

    if (!payload?.excludedTypes?.length) {
      return true;
    }

    return !payload.excludedTypes.includes(tool.type);
  });

  return filtered.length > 0 ? filtered : undefined;
}
