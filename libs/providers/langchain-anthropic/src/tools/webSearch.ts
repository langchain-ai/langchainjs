import Anthropic from "@anthropic-ai/sdk";
import { type ServerTool } from "@langchain/core/tools";

/**
 * Options for the web search tool.
 */
export interface WebSearch20250305Options {
  /**
   * Maximum number of times the tool can be used in the API request.
   */
  maxUses?: number;
  /**
   * If provided, only these domains will be included in results. Cannot be used
   * alongside `blocked_domains`.
   */
  allowedDomains?: string[];
  /**
   * If provided, these domains will never appear in results. Cannot be used
   * alongside `allowed_domains`.
   */
  blockedDomains?: string[];
  /**
   * Create a cache control breakpoint at this content block.
   */
  cacheControl?: Anthropic.Beta.BetaCacheControlEphemeral;
  /**
   * Parameters for the user's location. Used to provide more relevant search
   * results.
   */
  userLocation?: Anthropic.Beta.BetaWebSearchTool20250305.UserLocation;
  /**
   * If true, tool will not be included in initial system prompt. Only loaded when
   * returned via tool_reference from tool search.
   */
  deferLoading?: boolean;
  /**
   * If true, tool will only return results from the allowed domains.
   */
  strict?: boolean;
}

/**
 * Creates a web search tool that gives Claude direct access to real-time web content,
 * allowing it to answer questions with up-to-date information beyond its knowledge cutoff.
 * Claude automatically cites sources from search results as part of its answer.
 *
 * @see {@link https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool | Anthropic Web Search Documentation}
 * @param options - Configuration options for the web search tool
 * @returns A web search tool definition to be passed to the Anthropic API
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 *
 * const model = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 * });
 *
 * // Basic usage
 * const response = await model.invoke("What is the weather in NYC?", {
 *   tools: [tools.webSearch_20250305()],
 * });
 *
 * // With options
 * const responseWithOptions = await model.invoke("Latest news about AI?", {
 *   tools: [tools.webSearch_20250305({
 *     maxUses: 5,
 *     allowedDomains: ["reuters.com", "bbc.com"],
 *     userLocation: {
 *       type: "approximate",
 *       city: "San Francisco",
 *       region: "California",
 *       country: "US",
 *       timezone: "America/Los_Angeles",
 *     },
 *   })],
 * });
 * ```
 */
export function webSearch_20250305(
  options?: WebSearch20250305Options
): ServerTool {
  return {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: options?.maxUses,
    allowed_domains: options?.allowedDomains,
    blocked_domains: options?.blockedDomains,
    cache_control: options?.cacheControl,
    defer_loading: options?.deferLoading,
    strict: options?.strict,
    user_location: options?.userLocation,
  } satisfies Anthropic.Beta.BetaWebSearchTool20250305;
}
