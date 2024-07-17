import { ToolCall } from "../messages/tool.js";

export function _isToolCall(toolCall?: unknown): toolCall is ToolCall {
  return !!(
    toolCall &&
    typeof toolCall === "object" &&
    "type" in toolCall &&
    toolCall.type === "tool_call"
  );
}
