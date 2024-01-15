import { zodToJsonSchema } from "zod-to-json-schema";
import { StructuredToolInterface } from "../tools.js";
import { FunctionDefinition, ToolDefinition } from "../language_models/base.js";

export function convertToOpenAIFunction(
  tool: StructuredToolInterface
): FunctionDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.schema),
  };
}

export function convertToOpenAITool(
  tool: StructuredToolInterface
): ToolDefinition {
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
