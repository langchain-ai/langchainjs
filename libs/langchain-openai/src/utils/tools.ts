import { ToolDefinition } from "@langchain/core/language_models/base";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";
import {
  convertToOpenAIFunction,
  isLangChainTool,
} from "@langchain/core/utils/function_calling";
import { zodFunction } from "openai/helpers/zod";

/**
 * Formats a tool in either OpenAI format, or LangChain structured tool format
 * into an OpenAI tool format. If the tool is already in OpenAI format, return without
 * any changes. If it is in LangChain structured tool format, convert it to OpenAI tool format
 * using OpenAI's `zodFunction` util, falling back to `convertToOpenAIFunction` if the parameters
 * returned from the `zodFunction` util are not defined.
 *
 * @param {BindToolsInput} tool The tool to convert to an OpenAI tool.
 * @param {Object} [fields] Additional fields to add to the OpenAI tool.
 * @returns {ToolDefinition} The inputted tool in OpenAI tool format.
 */
export function _convertToOpenAITool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: BindToolsInput,
  fields?: {
    /**
     * If `true`, model output is guaranteed to exactly match the JSON Schema
     * provided in the function definition.
     */
    strict?: boolean;
  }
): ToolDefinition {
  let toolDef: ToolDefinition | undefined;

  if (isLangChainTool(tool)) {
    const oaiToolDef = zodFunction({
      name: tool.name,
      parameters: tool.schema,
      description: tool.description,
    });
    if (!oaiToolDef.function.parameters) {
      // Fallback to the `convertToOpenAIFunction` util if the parameters are not defined.
      toolDef = {
        type: "function",
        function: convertToOpenAIFunction(tool, fields),
      };
    } else {
      toolDef = {
        type: oaiToolDef.type,
        function: {
          name: oaiToolDef.function.name,
          description: oaiToolDef.function.description,
          parameters: oaiToolDef.function.parameters,
          ...(fields?.strict !== undefined ? { strict: fields.strict } : {}),
        },
      };
    }
  } else {
    toolDef = tool as ToolDefinition;
  }

  if (fields?.strict !== undefined) {
    toolDef.function.strict = fields.strict;
  }

  return toolDef;
}
