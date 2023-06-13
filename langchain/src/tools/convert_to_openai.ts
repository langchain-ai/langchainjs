import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatCompletionFunctions } from "openai";

import { StructuredTool } from "./base.js";

export function formatToOpenAIFunction(
  tool: StructuredTool
): ChatCompletionFunctions {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.schema),
  };
}
