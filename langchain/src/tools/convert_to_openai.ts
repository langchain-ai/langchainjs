import { zodToJsonSchema } from "zod-to-json-schema";
import type { OpenAIClient } from "@langchain/openai";
import type { StructuredToolInterface } from "@langchain/core/tools";

/**
 * Formats a `StructuredTool` instance into a format that is compatible
 * with OpenAI's ChatCompletionFunctions. It uses the `zodToJsonSchema`
 * function to convert the schema of the `StructuredTool` into a JSON
 * schema, which is then used as the parameters for the OpenAI function.
 */
export function formatToOpenAIFunction(
  tool: StructuredToolInterface
): OpenAIClient.Chat.ChatCompletionCreateParams.Function {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.schema),
  };
}

export function formatToOpenAITool(
  tool: StructuredToolInterface
): OpenAIClient.Chat.ChatCompletionTool {
  const schema = zodToJsonSchema(tool.schema);
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: schema,
    },
  };
}

export function formatToOpenAIAssistantTool(
  tool: StructuredToolInterface
): OpenAIClient.Beta.AssistantCreateParams.AssistantToolsFunction {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.schema),
    },
  };
}
