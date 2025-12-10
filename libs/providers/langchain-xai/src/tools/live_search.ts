import { tool } from "@langchain/core/tools";
import type { DynamicStructuredTool, ToolRuntime } from "@langchain/core/tools";
import type { XAISearchParameters } from "../live_search.js";

/**
 * Options for the xAI live search tool.
 * Controls how the model searches for and retrieves real-time information.
 */
export interface XAILiveSearchToolOptions extends XAISearchParameters {
  /**
   * Optional execute function that handles the search execution.
   * Since xAI search is server-side, this is typically not used for execution
   * but can be provided for compatibility.
   */
  execute?: (args: unknown) => Promise<string> | string;
}

/**
 * Creates an xAI built-in live search tool.
 * Enables the model to search the web for real-time information.
 *
 * This tool is executed server-side by the xAI API.
 *
 * @example
 * ```typescript
 * import { ChatXAI, xaiLiveSearch } from "@langchain/xai";
 *
 * const llm = new ChatXAI({
 *   model: "grok-beta",
 * });
 *
 * const searchTool = xaiLiveSearch({
 *   max_search_results: 5,
 *   from_date: "2024-01-01",
 *   return_citations: true
 * });
 *
 * const llmWithSearch = llm.bindTools([searchTool]);
 * const result = await llmWithSearch.invoke("What happened in tech today?");
 * ```
 */
export function xaiLiveSearch(
  options: XAILiveSearchToolOptions = {}
): DynamicStructuredTool {
  const { execute, ...searchParams } = options;
  const name = "live_search";

  const searchTool = tool(
    (async () => {
      // This is a server-side tool, so client-side execution is a no-op
      // unless a custom executor is provided.
      if (execute) {
        return execute({});
      }
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
