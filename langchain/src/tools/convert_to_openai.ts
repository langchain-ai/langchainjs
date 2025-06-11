import { ToolDefinition } from "@langchain/core/language_models/base";
import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  convertToOpenAIFunction,
  convertToOpenAITool,
} from "@langchain/core/utils/function_calling";
import { isInteropZodSchema } from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";

export function formatToOpenAIFunction(tool: StructuredToolInterface, fields?: { strict?: boolean } | number) {
  return convertToOpenAIFunction(tool, fields);
}

export function formatToOpenAITool(tool: StructuredToolInterface, fields?: { strict?: boolean } | number) {
  return convertToOpenAITool(tool, fields);
}

export function formatToOpenAIAssistantTool(
  tool: StructuredToolInterface
): ToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: isInteropZodSchema(tool.schema)
        ? toJsonSchema(tool.schema)
        : tool.schema,
    },
  };
}
