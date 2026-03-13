/**
 * xAI Collections Search tool type constant.
 * Note: The Responses API uses "file_search" as the type name.
 */
export const XAI_COLLECTIONS_SEARCH_TOOL_TYPE = "file_search";

/**
 * xAI's built-in collections search tool interface.
 * Enables the model to search through uploaded knowledge bases (collections)
 * to retrieve relevant information from your documents.
 *
 * This tool is part of xAI's agentic tool calling API and is particularly
 * powerful for:
 * - Document retrieval from uploaded files
 * - Semantic search across knowledge bases
 * - RAG (Retrieval-Augmented Generation) applications
 * - Enterprise knowledge base queries
 */
export interface XAICollectionsSearchTool {
  /**
   * The type of the tool. Must be "file_search".
   */
  type: typeof XAI_COLLECTIONS_SEARCH_TOOL_TYPE;
  /**
   * List of vector store (collection) IDs to search.
   * These are the IDs of collections created via the xAI Collections API.
   */
  vector_store_ids?: string[];
}

/**
 * Options for the xAI collections search tool (camelCase).
 * All fields are camel-cased for the TypeScript API and are mapped to the
 * corresponding snake_case fields in the API request.
 */
export interface XAICollectionsSearchToolOptions {
  /**
   * List of vector store (collection) IDs to search.
   * These are the IDs of collections created via the xAI Collections API.
   *
   * @example ["collection_abc123", "collection_def456"]
   */
  vectorStoreIds?: string[];
}

/**
 * Creates an xAI collections search tool.
 * Enables the model to search through your uploaded knowledge bases (collections)
 * to retrieve relevant information from your documents.
 *
 * This tool is executed server-side by the xAI API as part of the agentic
 * tool calling workflow.
 *
 * @param options - Configuration options for the collections search tool
 * @returns An XAICollectionsSearchTool object to pass to the model
 *
 * @example Basic usage with collection IDs
 * ```typescript
 * import { ChatXAIResponses, tools } from "@langchain/xai";
 *
 * const llm = new ChatXAIResponses({
 *   model: "grok-4-1-fast",
 * });
 *
 * const collectionsSearch = tools.xaiCollectionsSearch({
 *   vectorStoreIds: ["collection_abc123"],
 * });
 *
 * const result = await llm.invoke(
 *   "What are the key findings in the Q3 report?",
 *   { tools: [collectionsSearch] }
 * );
 * ```
 *
 * @example Combining with other tools for hybrid analysis
 * ```typescript
 * const collectionsSearch = tools.xaiCollectionsSearch({
 *   vectorStoreIds: ["collection_sec_filings"],
 * });
 * const webSearch = tools.xaiWebSearch();
 * const codeExecution = tools.xaiCodeExecution();
 *
 * const result = await llm.invoke(
 *   "Based on our internal SEC filings, what is the market sentiment on our performance?",
 *   { tools: [collectionsSearch, webSearch, codeExecution] }
 * );
 * ```
 */
export function xaiCollectionsSearch(
  options: XAICollectionsSearchToolOptions = {}
): XAICollectionsSearchTool {
  const tool: XAICollectionsSearchTool = {
    type: XAI_COLLECTIONS_SEARCH_TOOL_TYPE,
  };

  if (options.vectorStoreIds !== undefined) {
    tool.vector_store_ids = options.vectorStoreIds;
  }

  return tool;
}
