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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: StructuredToolInterface | Record<string, any>
): ToolDefinition {
  if (isStructuredTool(tool)) {
    return {
      type: "function",
      function: convertToOpenAIFunction(tool),
    };
  }
  return tool as ToolDefinition;
}

export function isStructuredTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool?: StructuredToolInterface | Record<string, any>
): tool is StructuredToolInterface {
  return (
    tool !== undefined &&
    Array.isArray((tool as StructuredToolInterface).lc_namespace)
  );
}
