import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v3";

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

/**
 * Text editor tool command types for Claude 4.x models.
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/text-editor-tool
 */
export type TextEditor20250728Command =
  | TextEditor20250728ViewCommand
  | TextEditor20250728StrReplaceCommand
  | TextEditor20250728CreateCommand
  | TextEditor20250728InsertCommand;

export interface TextEditor20250728ViewCommand {
  command: "view";
  path: string;
  view_range?: [number, number];
}

export interface TextEditor20250728StrReplaceCommand {
  command: "str_replace";
  path: string;
  old_str: string;
  new_str: string;
}

export interface TextEditor20250728CreateCommand {
  command: "create";
  path: string;
  file_text: string;
}

export interface TextEditor20250728InsertCommand {
  command: "insert";
  path: string;
  insert_line: number;
  new_str: string;
}

/**
 * Computer use tool action types for Claude Opus 4.5.
 * Includes zoom action which is not available in earlier versions.
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
 */
export type Computer20251124Action =
  | Computer20250124Action
  | ComputerZoomAction;

/**
 * Computer use tool action types for Claude Sonnet 4.5, Haiku 4.5, Opus 4.1, Sonnet 4, Opus 4, and Sonnet 3.7 versions.
 * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
 */
export type Computer20250124Action =
  | ComputerScreenshotAction
  | ComputerLeftClickAction
  | ComputerRightClickAction
  | ComputerMiddleClickAction
  | ComputerDoubleClickAction
  | ComputerTripleClickAction
  | ComputerLeftClickDragAction
  | ComputerLeftMouseDownAction
  | ComputerLeftMouseUpAction
  | ComputerScrollAction
  | ComputerTypeAction
  | ComputerKeyAction
  | ComputerMouseMoveAction
  | ComputerHoldKeyAction
  | ComputerWaitAction;

// Zod schemas for computer actions
const coordinateSchema = z.tuple([z.number(), z.number()]);

export const ComputerScreenshotActionSchema = z.object({
  action: z.literal("screenshot"),
});

export const ComputerLeftClickActionSchema = z.object({
  action: z.literal("left_click"),
  coordinate: coordinateSchema,
});

export const ComputerRightClickActionSchema = z.object({
  action: z.literal("right_click"),
  coordinate: coordinateSchema,
});

export const ComputerMiddleClickActionSchema = z.object({
  action: z.literal("middle_click"),
  coordinate: coordinateSchema,
});

export const ComputerDoubleClickActionSchema = z.object({
  action: z.literal("double_click"),
  coordinate: coordinateSchema,
});

export const ComputerTripleClickActionSchema = z.object({
  action: z.literal("triple_click"),
  coordinate: coordinateSchema,
});

export const ComputerLeftClickDragActionSchema = z.object({
  action: z.literal("left_click_drag"),
  start_coordinate: coordinateSchema,
  end_coordinate: coordinateSchema,
});

export const ComputerLeftMouseDownActionSchema = z.object({
  action: z.literal("left_mouse_down"),
  coordinate: coordinateSchema,
});

export const ComputerLeftMouseUpActionSchema = z.object({
  action: z.literal("left_mouse_up"),
  coordinate: coordinateSchema,
});

export const ComputerScrollActionSchema = z.object({
  action: z.literal("scroll"),
  coordinate: coordinateSchema,
  scroll_direction: z.enum(["up", "down", "left", "right"]),
  scroll_amount: z.number(),
});

export const ComputerTypeActionSchema = z.object({
  action: z.literal("type"),
  text: z.string(),
});

export const ComputerKeyActionSchema = z.object({
  action: z.literal("key"),
  key: z.string(),
});

export const ComputerMouseMoveActionSchema = z.object({
  action: z.literal("mouse_move"),
  coordinate: coordinateSchema,
});

export const ComputerHoldKeyActionSchema = z.object({
  action: z.literal("hold_key"),
  key: z.string(),
});

export const ComputerWaitActionSchema = z.object({
  action: z.literal("wait"),
  duration: z.number().optional(),
});

export const ComputerZoomActionSchema = z.object({
  action: z.literal("zoom"),
  region: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

// Discriminated union schemas
export const Computer20250124ActionSchema = z.discriminatedUnion("action", [
  ComputerScreenshotActionSchema,
  ComputerLeftClickActionSchema,
  ComputerRightClickActionSchema,
  ComputerMiddleClickActionSchema,
  ComputerDoubleClickActionSchema,
  ComputerTripleClickActionSchema,
  ComputerLeftClickDragActionSchema,
  ComputerLeftMouseDownActionSchema,
  ComputerLeftMouseUpActionSchema,
  ComputerScrollActionSchema,
  ComputerTypeActionSchema,
  ComputerKeyActionSchema,
  ComputerMouseMoveActionSchema,
  ComputerHoldKeyActionSchema,
  ComputerWaitActionSchema,
]);

export const Computer20251124ActionSchema = z.discriminatedUnion("action", [
  ComputerScreenshotActionSchema,
  ComputerLeftClickActionSchema,
  ComputerRightClickActionSchema,
  ComputerMiddleClickActionSchema,
  ComputerDoubleClickActionSchema,
  ComputerTripleClickActionSchema,
  ComputerLeftClickDragActionSchema,
  ComputerLeftMouseDownActionSchema,
  ComputerLeftMouseUpActionSchema,
  ComputerScrollActionSchema,
  ComputerTypeActionSchema,
  ComputerKeyActionSchema,
  ComputerMouseMoveActionSchema,
  ComputerHoldKeyActionSchema,
  ComputerWaitActionSchema,
  ComputerZoomActionSchema,
]);

// TypeScript types derived from Zod schemas
export type ComputerScreenshotAction = z.infer<
  typeof ComputerScreenshotActionSchema
>;

export type ComputerLeftClickAction = z.infer<
  typeof ComputerLeftClickActionSchema
>;

export type ComputerRightClickAction = z.infer<
  typeof ComputerRightClickActionSchema
>;

export type ComputerMiddleClickAction = z.infer<
  typeof ComputerMiddleClickActionSchema
>;

export type ComputerDoubleClickAction = z.infer<
  typeof ComputerDoubleClickActionSchema
>;

export type ComputerTripleClickAction = z.infer<
  typeof ComputerTripleClickActionSchema
>;

export type ComputerLeftClickDragAction = z.infer<
  typeof ComputerLeftClickDragActionSchema
>;

export type ComputerLeftMouseDownAction = z.infer<
  typeof ComputerLeftMouseDownActionSchema
>;

export type ComputerLeftMouseUpAction = z.infer<
  typeof ComputerLeftMouseUpActionSchema
>;

export type ComputerScrollAction = z.infer<typeof ComputerScrollActionSchema>;

export type ComputerTypeAction = z.infer<typeof ComputerTypeActionSchema>;

export type ComputerKeyAction = z.infer<typeof ComputerKeyActionSchema>;

export type ComputerMouseMoveAction = z.infer<
  typeof ComputerMouseMoveActionSchema
>;

export type ComputerHoldKeyAction = z.infer<typeof ComputerHoldKeyActionSchema>;

export type ComputerWaitAction = z.infer<typeof ComputerWaitActionSchema>;

export type ComputerZoomAction = z.infer<typeof ComputerZoomActionSchema>;

/**
 * Bash tool command types for Claude 4 models and Claude 3.7.
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/bash-tool
 */
export type Bash20250124Command =
  | Bash20250124ExecuteCommand
  | Bash20250124RestartCommand;

/**
 * Execute a bash command.
 */
export interface Bash20250124ExecuteCommand {
  /** The bash command to run */
  command: string;
  restart?: never;
}

/**
 * Restart the bash session to reset state.
 */
export interface Bash20250124RestartCommand {
  command?: never;
  /** Set to true to restart the bash session */
  restart: true;
}
