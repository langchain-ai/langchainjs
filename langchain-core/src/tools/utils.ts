import { ToolCall } from "../messages/tool.js";

export function _isToolCall(toolCall?: unknown): toolCall is ToolCall {
  return !!(
    toolCall &&
    typeof toolCall === "object" &&
    "type" in toolCall &&
    toolCall.type === "tool_call"
  );
}

/**
 * Custom error class used to handle exceptions related to tool input parsing.
 * It extends the built-in `Error` class and adds an optional `output`
 * property that can hold the output that caused the exception.
 */
export class ToolInputParsingException extends Error {
  output?: string;

  constructor(message: string, output?: string) {
    super(message);
    this.output = output;
  }
}
