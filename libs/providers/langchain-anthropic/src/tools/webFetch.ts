import Anthropic from "@anthropic-ai/sdk";
import { type ServerTool } from "@langchain/core/tools";

/**
 * Options for the web fetch tool.
 */
export interface WebFetch20250910Options {
  /**
   * Maximum number of times the tool can be used in the API request.
   */
  maxUses?: number;
  /**
   * If provided, only these domains will be fetched. Cannot be used
   * alongside `blockedDomains`.
   */
  allowedDomains?: string[];
  /**
   * If provided, these domains will never be fetched. Cannot be used
   * alongside `allowedDomains`.
   */
  blockedDomains?: string[];
  /**
   * Create a cache control breakpoint at this content block.
   */
  cacheControl?: Anthropic.Beta.BetaCacheControlEphemeral;
  /**
   * Enable citations for fetched content. Unlike web search where citations
   * are always enabled, citations are optional for web fetch.
   */
  citations?: {
    enabled: boolean;
  };
  /**
   * Maximum content length in tokens. If the fetched content exceeds this limit,
   * it will be truncated. This helps control token usage when fetching large documents.
   */
  maxContentTokens?: number;
}

/**
 * Creates a web fetch tool that allows Claude to retrieve full content from specified
 * web pages and PDF documents. Claude can only fetch URLs that have been explicitly
 * provided by the user or that come from previous web search or web fetch results.
 *
 * @warning Enabling the web fetch tool in environments where Claude processes untrusted
 * input alongside sensitive data poses data exfiltration risks. We recommend only using
 * this tool in trusted environments or when handling non-sensitive data.
 *
 * @see {@link https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-fetch-tool | Anthropic Web Fetch Documentation}
 * @param options - Configuration options for the web fetch tool
 * @returns A web fetch tool definition to be passed to the Anthropic API
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 *
 * const model = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 * });
 *
 * // Basic usage - fetch content from a URL
 * const response = await model.invoke(
 *   "Please analyze the content at https://example.com/article",
 *   { tools: [tools.webFetch_20250910()] }
 * );
 *
 * // With options
 * const responseWithOptions = await model.invoke(
 *   "Summarize this research paper: https://arxiv.org/abs/2024.12345",
 *   {
 *     tools: [tools.webFetch_20250910({
 *       maxUses: 5,
 *       allowedDomains: ["arxiv.org", "example.com"],
 *       citations: { enabled: true },
 *       maxContentTokens: 50000,
 *     })],
 *   }
 * );
 *
 * // Combined with web search for comprehensive information gathering
 * const combinedResponse = await model.invoke(
 *   "Find recent articles about quantum computing and analyze the most relevant one",
 *   {
 *     tools: [
 *       tools.webSearch_20250305({ maxUses: 3 }),
 *       tools.webFetch_20250910({ maxUses: 5, citations: { enabled: true } }),
 *     ],
 *   }
 * );
 * ```
 */
export function webFetch_20250910(
  options?: WebFetch20250910Options
): ServerTool {
  return {
    type: "web_fetch_20250910",
    name: "web_fetch",
    max_uses: options?.maxUses,
    allowed_domains: options?.allowedDomains,
    blocked_domains: options?.blockedDomains,
    cache_control: options?.cacheControl,
    citations: options?.citations,
    max_content_tokens: options?.maxContentTokens,
  } satisfies Anthropic.Beta.BetaWebFetchTool20250910;
}
