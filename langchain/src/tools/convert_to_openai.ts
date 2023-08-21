import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatCompletionFunctions } from "openai";

import { StructuredTool } from "./base.js";

/**
 * Formats a `StructuredTool` instance into a format that is compatible
 * with OpenAI's ChatCompletionFunctions. It uses the `zodToJsonSchema`
 * function to convert the schema of the `StructuredTool` into a JSON
 * schema, which is then used as the parameters for the OpenAI function.
 */
export function formatToOpenAIFunction(
  tool: StructuredTool
): ChatCompletionFunctions {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.schema),
  };
}
