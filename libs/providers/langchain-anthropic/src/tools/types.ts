import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";

/**
 * Memory tool command types as defined by Anthropic's memory tool API.
 * @beta
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool
 */

// Zod schemas for memory commands
export const Memory20250818ViewCommandSchema = z.object({
  command: z.literal("view"),
  path: z.string(),
});

export const Memory20250818CreateCommandSchema = z.object({
  command: z.literal("create"),
  path: z.string(),
  file_text: z.string(),
});

export const Memory20250818StrReplaceCommandSchema = z.object({
  command: z.literal("str_replace"),
  path: z.string(),
  old_str: z.string(),
  new_str: z.string(),
});

export const Memory20250818InsertCommandSchema = z.object({
  command: z.literal("insert"),
  path: z.string(),
  insert_line: z.number(),
  insert_text: z.string(),
});

export const Memory20250818DeleteCommandSchema = z.object({
  command: z.literal("delete"),
  path: z.string(),
});

export const Memory20250818RenameCommandSchema = z.object({
  command: z.literal("rename"),
  old_path: z.string(),
  new_path: z.string(),
});

// Discriminated union schema for all memory commands
export const Memory20250818CommandSchema = z.discriminatedUnion("command", [
  Memory20250818ViewCommandSchema,
  Memory20250818CreateCommandSchema,
  Memory20250818StrReplaceCommandSchema,
  Memory20250818InsertCommandSchema,
  Memory20250818DeleteCommandSchema,
  Memory20250818RenameCommandSchema,
]);

// TypeScript types derived from Zod schemas
export type Memory20250818ViewCommand = z.infer<
  typeof Memory20250818ViewCommandSchema
>;
export type Memory20250818CreateCommand = z.infer<
  typeof Memory20250818CreateCommandSchema
>;
export type Memory20250818StrReplaceCommand = z.infer<
  typeof Memory20250818StrReplaceCommandSchema
>;
export type Memory20250818InsertCommand = z.infer<
  typeof Memory20250818InsertCommandSchema
>;
export type Memory20250818DeleteCommand = z.infer<
  typeof Memory20250818DeleteCommandSchema
>;
export type Memory20250818RenameCommand = z.infer<
  typeof Memory20250818RenameCommandSchema
>;

export type Memory20250818Command = z.infer<typeof Memory20250818CommandSchema>;

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

// Zod schemas for text editor commands
export const TextEditor20250728ViewCommandSchema = z.object({
  command: z.literal("view"),
  path: z.string(),
  view_range: z.tuple([z.number(), z.number()]).optional(),
});

export const TextEditor20250728StrReplaceCommandSchema = z.object({
  command: z.literal("str_replace"),
  path: z.string(),
  old_str: z.string(),
  new_str: z.string(),
});

export const TextEditor20250728CreateCommandSchema = z.object({
  command: z.literal("create"),
  path: z.string(),
  file_text: z.string(),
});

export const TextEditor20250728InsertCommandSchema = z.object({
  command: z.literal("insert"),
  path: z.string(),
  insert_line: z.number(),
  new_str: z.string(),
});

// Discriminated union schema for all text editor commands
export const TextEditor20250728CommandSchema = z.discriminatedUnion("command", [
  TextEditor20250728ViewCommandSchema,
  TextEditor20250728StrReplaceCommandSchema,
  TextEditor20250728CreateCommandSchema,
  TextEditor20250728InsertCommandSchema,
]);

// TypeScript types derived from Zod schemas
export type TextEditor20250728ViewCommand = z.infer<
  typeof TextEditor20250728ViewCommandSchema
>;
export type TextEditor20250728StrReplaceCommand = z.infer<
  typeof TextEditor20250728StrReplaceCommandSchema
>;
export type TextEditor20250728CreateCommand = z.infer<
  typeof TextEditor20250728CreateCommandSchema
>;
export type TextEditor20250728InsertCommand = z.infer<
  typeof TextEditor20250728InsertCommandSchema
>;
export type TextEditor20250728Command = z.infer<
  typeof TextEditor20250728CommandSchema
>;

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

// Zod schemas for bash commands
export const Bash20250124ExecuteCommandSchema = z.object({
  command: z.string().describe("The bash command to run"),
});

export const Bash20250124RestartCommandSchema = z.object({
  restart: z.literal(true).describe("Set to true to restart the bash session"),
});

// Union schema for all bash commands
export const Bash20250124CommandSchema = z.union([
  Bash20250124ExecuteCommandSchema,
  Bash20250124RestartCommandSchema,
]);

// TypeScript types derived from Zod schemas
export type Bash20250124ExecuteCommand = z.infer<
  typeof Bash20250124ExecuteCommandSchema
>;
export type Bash20250124RestartCommand = z.infer<
  typeof Bash20250124RestartCommandSchema
>;
export type Bash20250124Command = z.infer<typeof Bash20250124CommandSchema>;
