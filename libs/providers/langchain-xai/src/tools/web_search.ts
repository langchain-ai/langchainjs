/**
 * xAI Web Search tool type constant.
 */
export const XAI_WEB_SEARCH_TOOL_TYPE = "web_search";

/**
 * xAI's built-in web search tool interface.
 * Enables the model to search the web and browse pages for real-time information.
 *
 * This tool is part of xAI's agentic tool calling API.
 */
export interface XAIWebSearchTool {
  /**
   * The type of the tool. Must be "web_search".
   */
  type: typeof XAI_WEB_SEARCH_TOOL_TYPE;
  /**
   * Domains to exclusively include in the search (max 5).
   * Cannot be used together with `excluded_domains`.
   */
  allowed_domains?: string[];
  /**
   * Domains to exclude from the search (max 5).
   * Cannot be used together with `allowed_domains`.
   */
  excluded_domains?: string[];
  /**
   * Whether to enable image understanding.
   * When enabled, the model can analyze images encountered during search.
   */
  enable_image_understanding?: boolean;
}

/**
 * Options for the xAI web search tool (camelCase).
 * All fields are camel-cased for the TypeScript API and are mapped to the
 * corresponding snake_case fields in the API request.
 */
export interface XAIWebSearchToolOptions {
  /**
   * Domains to exclusively include in the search (max 5).
   * Cannot be used together with `excludedDomains`.
   *
   * @example ["wikipedia.org", "github.com"]
   */
  allowedDomains?: string[];
  /**
   * Domains to exclude from the search (max 5).
   * Cannot be used together with `allowedDomains`.
   *
   * @example ["example.com"]
   */
  excludedDomains?: string[];
  /**
   * Whether to enable image understanding.
   * When enabled, the model can analyze images encountered during search.
   * Note: This increases token usage as images are processed.
   *
   * @default false
   */
  enableImageUnderstanding?: boolean;
}

/**
 * Creates an xAI web search tool.
 * Enables the model to search the web and browse pages for real-time information.
 *
 * This tool is executed server-side by the xAI API as part of the agentic
 * tool calling workflow.
 *
 * @param options - Configuration options for the web search tool
 * @returns An XAIWebSearchTool object to pass to the model
 *
 * @example Basic usage
 * ```typescript
 * import { ChatXAIResponses, tools } from "@langchain/xai";
 *
 * const llm = new ChatXAIResponses({
 *   model: "grok-4-1-fast",
 * });
 *
 * const webSearch = tools.xaiWebSearch();
 * const result = await llm.invoke("What are the latest AI developments?", {
 *   tools: [webSearch],
 * });
 * ```
 *
 * @example With domain filtering
 * ```typescript
 * const webSearch = tools.xaiWebSearch({
 *   allowedDomains: ["wikipedia.org", "arxiv.org"],
 *   enableImageUnderstanding: true,
 * });
 * ```
 *
 * @example Excluding specific domains
 * ```typescript
 * const webSearch = tools.xaiWebSearch({
 *   excludedDomains: ["example.com"],
 * });
 * ```
 */
export function xaiWebSearch(
  options: XAIWebSearchToolOptions = {}
): XAIWebSearchTool {
  const tool: XAIWebSearchTool = {
    type: XAI_WEB_SEARCH_TOOL_TYPE,
  };

  if (options.allowedDomains !== undefined) {
    tool.allowed_domains = options.allowedDomains;
  }

  if (options.excludedDomains !== undefined) {
    tool.excluded_domains = options.excludedDomains;
  }

  if (options.enableImageUnderstanding !== undefined) {
    tool.enable_image_understanding = options.enableImageUnderstanding;
  }

  return tool;
}
