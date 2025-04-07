import { ToolDefinition } from "@langchain/core/language_models/base";
import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  convertToOpenAIFunction,
  convertToOpenAITool,
} from "@langchain/core/utils/function_calling";
import { isZodSchema } from "@langchain/core/utils/types";
import { zodToJsonSchema } from "zod-to-json-schema";

export {
  convertToOpenAIFunction as formatToOpenAIFunction,
  convertToOpenAITool as formatToOpenAITool,
};

export function formatToOpenAIAssistantTool(
  tool: StructuredToolInterface
): ToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: isZodSchema(tool.schema)
        ? zodToJsonSchema(tool.schema)
        : tool.schema,
    },
  };
}
