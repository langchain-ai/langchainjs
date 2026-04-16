/**
 * xAI X Search tool type constant.
 */
export const XAI_X_SEARCH_TOOL_TYPE = "x_search";

/**
 * xAI's built-in X (formerly Twitter) search tool interface.
 * Enables the model to perform keyword search, semantic search, user search,
 * and thread fetch on X.
 *
 * This tool is part of xAI's agentic tool calling API.
 */
export interface XAIXSearchTool {
  /**
   * The type of the tool. Must be "x_search".
   */
  type: typeof XAI_X_SEARCH_TOOL_TYPE;
  /**
   * X handles to exclusively include in the search (max 10).
   * Cannot be used together with `excluded_x_handles`.
   */
  allowed_x_handles?: string[];
  /**
   * X handles to exclude from the search (max 10).
   * Cannot be used together with `allowed_x_handles`.
   */
  excluded_x_handles?: string[];
  /**
   * Start date for search results (ISO-8601 format: "YYYY-MM-DD").
   * Only posts from this date onwards will be included.
   */
  from_date?: string;
  /**
   * End date for search results (ISO-8601 format: "YYYY-MM-DD").
   * Only posts up to this date will be included.
   */
  to_date?: string;
  /**
   * Whether to enable image understanding.
   * When enabled, the model can analyze images in X posts.
   */
  enable_image_understanding?: boolean;
  /**
   * Whether to enable video understanding.
   * When enabled, the model can analyze videos in X posts.
   */
  enable_video_understanding?: boolean;
}

/**
 * Options for the xAI X search tool (camelCase).
 * All fields are camel-cased for the TypeScript API and are mapped to the
 * corresponding snake_case fields in the API request.
 */
export interface XAIXSearchToolOptions {
  /**
   * X handles to exclusively include in the search (max 10).
   * Cannot be used together with `excludedXHandles`.
   *
   * @example ["elonmusk", "xai"]
   */
  allowedXHandles?: string[];
  /**
   * X handles to exclude from the search (max 10).
   * Cannot be used together with `allowedXHandles`.
   *
   * @example ["spamaccount"]
   */
  excludedXHandles?: string[];
  /**
   * Start date for search results (ISO-8601 format: "YYYY-MM-DD").
   * Only posts from this date onwards will be included.
   *
   * @example "2024-01-01"
   */
  fromDate?: string;
  /**
   * End date for search results (ISO-8601 format: "YYYY-MM-DD").
   * Only posts up to this date will be included.
   *
   * @example "2024-12-31"
   */
  toDate?: string;
  /**
   * Whether to enable image understanding.
   * When enabled, the model can analyze images in X posts.
   * Note: This increases token usage as images are processed.
   *
   * @default false
   */
  enableImageUnderstanding?: boolean;
  /**
   * Whether to enable video understanding.
   * When enabled, the model can analyze videos in X posts.
   * Note: This increases token usage as video content is processed.
   *
   * @default false
   */
  enableVideoUnderstanding?: boolean;
}

/**
 * Creates an xAI X search tool.
 * Enables the model to perform keyword search, semantic search, user search,
 * and thread fetch on X (formerly Twitter).
 *
 * This tool is executed server-side by the xAI API as part of the agentic
 * tool calling workflow.
 *
 * @param options - Configuration options for the X search tool
 * @returns An XAIXSearchTool object to pass to the model
 *
 * @example Basic usage
 * ```typescript
 * import { ChatXAIResponses, tools } from "@langchain/xai";
 *
 * const llm = new ChatXAIResponses({
 *   model: "grok-4-1-fast",
 * });
 *
 * const xSearch = tools.xaiXSearch();
 * const result = await llm.invoke("What is the current status of xAI?", {
 *   tools: [xSearch],
 * });
 * ```
 *
 * @example With handle filtering
 * ```typescript
 * const xSearch = tools.xaiXSearch({
 *   allowedXHandles: ["elonmusk", "xai"],
 *   enableImageUnderstanding: true,
 * });
 * ```
 *
 * @example With date range
 * ```typescript
 * const xSearch = tools.xaiXSearch({
 *   fromDate: "2024-10-01",
 *   toDate: "2024-10-31",
 *   enableVideoUnderstanding: true,
 * });
 * ```
 */
export function xaiXSearch(
  options: XAIXSearchToolOptions = {}
): XAIXSearchTool {
  const tool: XAIXSearchTool = {
    type: XAI_X_SEARCH_TOOL_TYPE,
  };

  if (options.allowedXHandles !== undefined) {
    tool.allowed_x_handles = options.allowedXHandles;
  }

  if (options.excludedXHandles !== undefined) {
    tool.excluded_x_handles = options.excludedXHandles;
  }

  if (options.fromDate !== undefined) {
    tool.from_date = options.fromDate;
  }

  if (options.toDate !== undefined) {
    tool.to_date = options.toDate;
  }

  if (options.enableImageUnderstanding !== undefined) {
    tool.enable_image_understanding = options.enableImageUnderstanding;
  }

  if (options.enableVideoUnderstanding !== undefined) {
    tool.enable_video_understanding = options.enableVideoUnderstanding;
  }

  return tool;
}
