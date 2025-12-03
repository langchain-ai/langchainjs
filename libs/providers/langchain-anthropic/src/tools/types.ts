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
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use
 */
export type Computer20251124Action =
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
  | ComputerWaitAction
  | ComputerZoomAction;

/**
 * Computer use tool action types for Claude 4 models and Claude 3.7.
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use
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

export interface ComputerScreenshotAction {
  action: "screenshot";
}

export interface ComputerLeftClickAction {
  action: "left_click";
  coordinate: [number, number];
}

export interface ComputerRightClickAction {
  action: "right_click";
  coordinate: [number, number];
}

export interface ComputerMiddleClickAction {
  action: "middle_click";
  coordinate: [number, number];
}

export interface ComputerDoubleClickAction {
  action: "double_click";
  coordinate: [number, number];
}

export interface ComputerTripleClickAction {
  action: "triple_click";
  coordinate: [number, number];
}

export interface ComputerLeftClickDragAction {
  action: "left_click_drag";
  start_coordinate: [number, number];
  end_coordinate: [number, number];
}

export interface ComputerLeftMouseDownAction {
  action: "left_mouse_down";
  coordinate: [number, number];
}

export interface ComputerLeftMouseUpAction {
  action: "left_mouse_up";
  coordinate: [number, number];
}

export interface ComputerScrollAction {
  action: "scroll";
  coordinate: [number, number];
  scroll_direction: "up" | "down" | "left" | "right";
  scroll_amount: number;
}

export interface ComputerTypeAction {
  action: "type";
  text: string;
}

export interface ComputerKeyAction {
  action: "key";
  key: string;
}

export interface ComputerMouseMoveAction {
  action: "mouse_move";
  coordinate: [number, number];
}

export interface ComputerHoldKeyAction {
  action: "hold_key";
  key: string;
}

export interface ComputerWaitAction {
  action: "wait";
  duration?: number;
}

/**
 * Zoom action for Claude Opus 4.5 only.
 * Allows viewing a specific region of the screen at full resolution.
 */
export interface ComputerZoomAction {
  action: "zoom";
  /** Coordinates [x1, y1, x2, y2] defining top-left and bottom-right corners */
  region: [number, number, number, number];
}
