import { StructuredToolInterface } from "@langchain/core/tools";
import {
  ToolDefinition,
  isOpenAITool,
} from "@langchain/core/language_models/base";
import {
  toJsonSchema,
  type JsonSchema7Type,
} from "@langchain/core/utils/json_schema";
import { isInteropZodSchema } from "@langchain/core/utils/types";

/**
 * Render the tool name and description in plain text.
 *
 * Output will be in the format of:
 * ```
 * search: This tool is used for search
 * calculator: This tool is used for math
 * ```
 * @param tools
 * @returns a string of all tools and their descriptions
 */
export function renderTextDescription(
  tools: StructuredToolInterface[] | ToolDefinition[]
): string {
  if ((tools as unknown[]).every(isOpenAITool)) {
    return (tools as ToolDefinition[])
      .map(
        (tool) =>
          `${tool.function.name}${
            tool.function.description ? `: ${tool.function.description}` : ""
          }`
      )
      .join("\n");
  }
  return (tools as StructuredToolInterface[])
    .map((tool) => `${tool.name}: ${tool.description}`)
    .join("\n");
}

/**
 * Render the tool name, description, and args in plain text.
 * Output will be in the format of:'
 * ```
 * search: This tool is used for search, args: {"query": {"type": "string"}}
 * calculator: This tool is used for math,
 * args: {"expression": {"type": "string"}}
 * ```
 * @param tools
 * @returns a string of all tools, their descriptions and a stringified version of their schemas
 */
export function renderTextDescriptionAndArgs(
  tools: StructuredToolInterface[] | ToolDefinition[]
): string {
  if ((tools as unknown[]).every(isOpenAITool)) {
    return (tools as ToolDefinition[])
      .map(
        (tool) =>
          `${tool.function.name}${
            tool.function.description ? `: ${tool.function.description}` : ""
          }, args: ${JSON.stringify(tool.function.parameters)}`
      )
      .join("\n");
  }
  return (tools as StructuredToolInterface[])
    .map((tool) => {
      const jsonSchema = (
        isInteropZodSchema(tool.schema)
          ? toJsonSchema(tool.schema)
          : tool.schema
      ) as { properties?: Record<string, JsonSchema7Type> } | undefined;
      return `${tool.name}: ${tool.description}, args: ${JSON.stringify(
        jsonSchema?.properties
      )}`;
    })
    .join("\n");
}
