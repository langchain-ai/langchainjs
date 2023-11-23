import {
  APIConnectionTimeoutError,
  APIUserAbortError,
  type OpenAI as OpenAIClient,
} from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { StructuredTool } from "@langchain/core/tools";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapOpenAIClientError(e: any) {
  let error;
  if (e.constructor.name === APIConnectionTimeoutError.name) {
    error = new Error(e.message);
    error.name = "TimeoutError";
  } else if (e.constructor.name === APIUserAbortError.name) {
    error = new Error(e.message);
    error.name = "AbortError";
  } else {
    error = e;
  }
  return error;
}

/**
 * Formats a `StructuredTool` instance into a format that is compatible
 * with OpenAI's ChatCompletionFunctions. It uses the `zodToJsonSchema`
 * function to convert the schema of the `StructuredTool` into a JSON
 * schema, which is then used as the parameters for the OpenAI function.
 */
export function formatToOpenAIFunction(
  tool: StructuredTool
): OpenAIClient.Chat.ChatCompletionCreateParams.Function {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.schema),
  };
}

export function formatToOpenAITool(
  tool: StructuredTool
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
  tool: StructuredTool
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
