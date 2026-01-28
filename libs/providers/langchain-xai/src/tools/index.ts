import { xaiLiveSearch } from "./live_search.js";
import { xaiWebSearch } from "./web_search.js";
import { xaiXSearch } from "./x_search.js";
import { xaiCodeExecution } from "./code_execution.js";
import { xaiCollectionsSearch } from "./collections_search.js";

export const tools = {
  /** @deprecated Use xaiWebSearch and xaiXSearch instead */
  xaiLiveSearch,
  xaiWebSearch,
  xaiXSearch,
  xaiCodeExecution,
  xaiCollectionsSearch,
};

// Re-export types for convenience
export type { XAILiveSearchTool, XAILiveSearchToolOptions } from "./live_search.js";
export type { XAIWebSearchTool, XAIWebSearchToolOptions } from "./web_search.js";
export type { XAIXSearchTool, XAIXSearchToolOptions } from "./x_search.js";
export type { XAICodeExecutionTool } from "./code_execution.js";
export type { XAICollectionsSearchTool, XAICollectionsSearchToolOptions } from "./collections_search.js";

// Re-export tool type constants
export { XAI_LIVE_SEARCH_TOOL_TYPE, XAI_LIVE_SEARCH_TOOL_NAME } from "./live_search.js";
export { XAI_WEB_SEARCH_TOOL_TYPE } from "./web_search.js";
export { XAI_X_SEARCH_TOOL_TYPE } from "./x_search.js";
export { XAI_CODE_EXECUTION_TOOL_TYPE } from "./code_execution.js";
export { XAI_COLLECTIONS_SEARCH_TOOL_TYPE } from "./collections_search.js";
