import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import type { ToolDefinition } from "@langchain/core/language_models/base";
import type { OpenRouter } from "../api-types.js";

/**
 * Convert LangChain tool inputs to the OpenRouter (OpenAI-compatible) format.
 */
export function convertToolsToOpenRouter(
  tools: BindToolsInput[],
  options?: { strict?: boolean }
): OpenRouter.ToolDefinitionJson[] {
  return tools.map((tool) => {
    const converted: ToolDefinition = convertToOpenAITool(tool, {
      strict: options?.strict,
    });
    return converted as unknown as OpenRouter.ToolDefinitionJson;
  });
}

/**
 * Convert a LangChain `ToolChoice` value to the OpenRouter wire format.
 */
export function formatToolChoice(
  toolChoice?: string | Record<string, unknown>
): OpenRouter.ToolChoiceOption | undefined {
  if (toolChoice === undefined || toolChoice === null) return undefined;
  if (toolChoice === "auto") return "auto";
  if (toolChoice === "none") return "none";
  if (toolChoice === "any" || toolChoice === "required") return "required";
  if (typeof toolChoice === "string") {
    return { type: "function", function: { name: toolChoice } };
  }
  return toolChoice as unknown as OpenRouter.ToolChoiceOption;
}
