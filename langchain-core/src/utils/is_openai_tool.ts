import { ToolDefinition } from "../language_models/base.js";

export function isOpenAITool(tool: unknown): tool is ToolDefinition {
  if (typeof tool !== "object" || !tool) return false;
  if (
    "type" in tool &&
    tool.type === "function" &&
    "function" in tool &&
    typeof tool.function === "object" &&
    tool.function &&
    "name" in tool.function &&
    "parameters" in tool.function
  ) {
    return true;
  }
  return false;
}
