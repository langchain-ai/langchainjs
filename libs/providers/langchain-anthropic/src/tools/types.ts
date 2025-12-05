import Anthropic from "@anthropic-ai/sdk";

/**
 * Memory tool command types as defined by Anthropic's memory tool API.
 * @beta
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool
 */
export type Memory20250818Command =
  | Memory20250818ViewCommand
  | Memory20250818CreateCommand
  | Memory20250818StrReplaceCommand
  | Memory20250818InsertCommand
  | Memory20250818DeleteCommand
  | Memory20250818RenameCommand;

export type Memory20250818ViewCommand =
  Anthropic.Beta.BetaMemoryTool20250818ViewCommand;
export type Memory20250818CreateCommand =
  Anthropic.Beta.BetaMemoryTool20250818CreateCommand;
export type Memory20250818StrReplaceCommand =
  Anthropic.Beta.BetaMemoryTool20250818StrReplaceCommand;
export type Memory20250818InsertCommand =
  Anthropic.Beta.BetaMemoryTool20250818InsertCommand;
export type Memory20250818DeleteCommand =
  Anthropic.Beta.BetaMemoryTool20250818DeleteCommand;
export type Memory20250818RenameCommand =
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
  execute: (action: Memory20250818Command) => Promise<string> | string;
}

/**
 * Memory tool type definition.
 */
export type MemoryTool20250818 = Anthropic.Beta.BetaMemoryTool20250818;
