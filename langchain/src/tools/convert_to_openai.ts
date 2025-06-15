import { zodToJsonSchema } from "zod-to-json-schema";
import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  convertToOpenAIFunction,
  convertToOpenAITool,
} from "@langchain/core/utils/function_calling";

export {
  convertToOpenAIFunction as formatToOpenAIFunction,
  convertToOpenAITool as formatToOpenAITool,
};

export function formatToOpenAIAssistantTool(tool: StructuredToolInterface) {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.schema),
    },
  };
}
