import Anthropic from "@anthropic-ai/sdk";

/**
 * Memory tool command types as defined by Anthropic's memory tool API.
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool
 */
export type MemoryCommand =
  | MemoryViewCommand
  | MemoryCreateCommand
  | MemoryStrReplaceCommand
  | MemoryInsertCommand
  | MemoryDeleteCommand
  | MemoryRenameCommand;

export type MemoryViewCommand =
  Anthropic.Beta.BetaMemoryTool20250818ViewCommand;
export type MemoryCreateCommand =
  Anthropic.Beta.BetaMemoryTool20250818CreateCommand;
export type MemoryStrReplaceCommand =
  Anthropic.Beta.BetaMemoryTool20250818StrReplaceCommand;
export type MemoryInsertCommand =
  Anthropic.Beta.BetaMemoryTool20250818InsertCommand;
export type MemoryDeleteCommand =
  Anthropic.Beta.BetaMemoryTool20250818DeleteCommand;
export type MemoryRenameCommand =
  Anthropic.Beta.BetaMemoryTool20250818RenameCommand;

/**
 * Options for creating a memory tool.
 */
export interface MemoryTool20250818Options {
  /**
   * Optional execute function that handles memory command execution.
   * In LangChain, this is typically handled separately when processing tool calls,
   * but this option is provided for compatibility with the AI SDK pattern.
   * Note: This option is currently unused but reserved for future use.
   */
  execute?: (
    action: Anthropic.Beta.BetaMemoryTool20250818Command
  ) => Promise<string> | string;
}

/**
 * Memory tool type definition.
 */
export type MemoryTool = Anthropic.Beta.BetaMemoryTool20250818;
