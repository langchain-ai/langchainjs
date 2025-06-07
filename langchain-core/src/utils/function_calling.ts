import {
  StructuredToolInterface,
  StructuredToolParams,
  isLangChainTool,
} from "../tools/types.js";
import { FunctionDefinition, ToolDefinition } from "../language_models/base.js";
import { RunnableToolLike } from "../runnables/base.js";
import { toJsonSchema } from "./json_schema.js";

// These utility functions were moved to a more appropriate location,
// but we still export them here for backwards compatibility.
export {
  isStructuredTool,
  isStructuredToolParams,
  isRunnableToolLike,
  isLangChainTool,
} from "../tools/types.js";

/**
 * Formats a `StructuredTool` or `RunnableToolLike` instance into a format
 * that is compatible with OpenAI function calling. If `StructuredTool` or
 * `RunnableToolLike` has a zod schema, the output will be converted into a
 * JSON schema, which is then used as the parameters for the OpenAI tool.
 *
 * @param {StructuredToolInterface | RunnableToolLike} tool The tool to convert to an OpenAI function.
 * @returns {FunctionDefinition} The inputted tool in OpenAI function format.
 */
export function convertToOpenAIFunction(
  tool: StructuredToolInterface | RunnableToolLike | StructuredToolParams,
  fields?:
    | {
        /**
         * If `true`, model output is guaranteed to exactly match the JSON Schema
         * provided in the function definition.
         */
        strict?: boolean;
      }
    | number
): FunctionDefinition {
  // @TODO 0.3.0 Remove the `number` typing
  const fieldsCopy = typeof fields === "number" ? undefined : fields;

  return {
    name: tool.name,
    description: tool.description,
    parameters: toJsonSchema(tool.schema),
    // Do not include the `strict` field if it is `undefined`.
    ...(fieldsCopy?.strict !== undefined ? { strict: fieldsCopy.strict } : {}),
  };
}

/**
 * Formats a `StructuredTool` or `RunnableToolLike` instance into a
 * format that is compatible with OpenAI tool calling. If `StructuredTool` or
 * `RunnableToolLike` has a zod schema, the output will be converted into a
 * JSON schema, which is then used as the parameters for the OpenAI tool.
 *
 * @param {StructuredToolInterface | Record<string, any> | RunnableToolLike} tool The tool to convert to an OpenAI tool.
 * @returns {ToolDefinition} The inputted tool in OpenAI tool format.
 */
export function convertToOpenAITool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: StructuredToolInterface | Record<string, any> | RunnableToolLike,
  fields?:
    | {
        /**
         * If `true`, model output is guaranteed to exactly match the JSON Schema
         * provided in the function definition.
         */
        strict?: boolean;
      }
    | number
): ToolDefinition {
  // @TODO 0.3.0 Remove the `number` typing
  const fieldsCopy = typeof fields === "number" ? undefined : fields;

  let toolDef: ToolDefinition | undefined;
  if (isLangChainTool(tool)) {
    toolDef = {
      type: "function",
      function: convertToOpenAIFunction(tool),
    };
  } else {
    toolDef = tool as ToolDefinition;
  }

  if (fieldsCopy?.strict !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (toolDef.function as any).strict = fieldsCopy.strict;
  }

  return toolDef;
}
