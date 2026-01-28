export * from "./dalle.js";

import { webSearch } from "./webSearch.js";
export type {
  WebSearchTool,
  WebSearchFilters,
  WebSearchOptions,
} from "./webSearch.js";

import { mcp } from "./mcp.js";
export type {
  McpTool,
  McpConnectorId,
  McpToolFilter,
  McpApprovalFilter,
  McpRemoteServerOptions,
  McpConnectorOptions,
} from "./mcp.js";

import { codeInterpreter } from "./codeInterpreter.js";
export type {
  CodeInterpreterTool,
  CodeInterpreterOptions,
  CodeInterpreterAutoContainer,
  CodeInterpreterMemoryLimit,
} from "./codeInterpreter.js";

import { fileSearch } from "./fileSearch.js";
export type {
  FileSearchTool,
  FileSearchOptions,
  FileSearchFilter,
  FileSearchComparisonFilter,
  FileSearchCompoundFilter,
  FileSearchComparisonType,
  FileSearchRankingOptions,
  FileSearchHybridSearchWeights,
} from "./fileSearch.js";

import { imageGeneration } from "./imageGeneration.js";
export type {
  ImageGenerationTool,
  ImageGenerationOptions,
  ImageGenerationInputMask,
} from "./imageGeneration.js";

import { computerUse } from "./computerUse.js";
export type {
  ComputerUseTool,
  ComputerUseInput,
  ComputerUseOptions,
  ComputerUseEnvironment,
  ComputerUseAction,
  ComputerUseClickAction,
  ComputerUseDoubleClickAction,
  ComputerUseDragAction,
  ComputerUseKeypressAction,
  ComputerUseMoveAction,
  ComputerUseScreenshotAction,
  ComputerUseScrollAction,
  ComputerUseTypeAction,
  ComputerUseWaitAction,
} from "./computerUse.js";

import { localShell } from "./localShell.js";
export type {
  LocalShellTool,
  LocalShellOptions,
  LocalShellAction,
} from "./localShell.js";

import { shell } from "./shell.js";
export type {
  ShellTool,
  ShellOptions,
  ShellAction,
  ShellResult,
  ShellCommandOutput,
  ShellCallOutcome,
} from "./shell.js";

import { applyPatch } from "./applyPatch.js";
export type {
  ApplyPatchTool,
  ApplyPatchOptions,
  ApplyPatchOperation,
  ApplyPatchCreateFileOperation,
  ApplyPatchUpdateFileOperation,
  ApplyPatchDeleteFileOperation,
} from "./applyPatch.js";

export const tools = {
  webSearch,
  mcp,
  codeInterpreter,
  fileSearch,
  imageGeneration,
  computerUse,
  localShell,
  shell,
  applyPatch,
};
