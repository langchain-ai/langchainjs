import { ToolDefinition } from "@langchain/core/language_models/base";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { isZodSchema } from "@langchain/core/utils/types";
import { zodToJsonSchema } from "zod-to-json-schema";

export {
  convertToOpenAIFunction as formatToOpenAIFunction,
  convertToOpenAITool as formatToOpenAITool,
} from "@langchain/core/utils/function_calling";

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
