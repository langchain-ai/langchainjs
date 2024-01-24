import { zodToJsonSchema } from "zod-to-json-schema";
import { StructuredToolInterface } from "../tools.js";
import { FunctionDefinition, ToolDefinition } from "../language_models/base.js";

/**
 * Formats a `StructuredTool` instance into a format that is compatible
 * with OpenAI function calling. It uses the `zodToJsonSchema`
 * function to convert the schema of the `StructuredTool` into a JSON
 * schema, which is then used as the parameters for the OpenAI function.
 */
export function convertToOpenAIFunction(
  tool: StructuredToolInterface
): FunctionDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.schema),
  };
}

/**
 * Formats a `StructuredTool` instance into a format that is compatible
 * with OpenAI tool calling. It uses the `zodToJsonSchema`
 * function to convert the schema of the `StructuredTool` into a JSON
 * schema, which is then used as the parameters for the OpenAI tool.
 */
export function convertToOpenAITool(
  tool: StructuredToolInterface
): ToolDefinition {
  return {
    type: "function",
    function: convertToOpenAIFunction(tool),
  };
}
