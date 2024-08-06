import { zodToJsonSchema } from "zod-to-json-schema";
import { StructuredToolInterface } from "../tools/index.js";
import { FunctionDefinition, ToolDefinition } from "../language_models/base.js";
import { Runnable, RunnableToolLike } from "../runnables/base.js";

/**
 * Formats a `StructuredTool` or `RunnableToolLike` instance into a format
 * that is compatible with OpenAI function calling. It uses the `zodToJsonSchema`
 * function to convert the schema of the `StructuredTool` or `RunnableToolLike`
 * into a JSON schema, which is then used as the parameters for the OpenAI function.
 *
 * @param {StructuredToolInterface | RunnableToolLike} tool The tool to convert to an OpenAI function.
 * @returns {FunctionDefinition} The inputted tool in OpenAI function format.
 */
export function convertToOpenAIFunction(
  tool: StructuredToolInterface | RunnableToolLike
): FunctionDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.schema),
  };
}

/**
 * Formats a `StructuredTool` or `RunnableToolLike` instance into a
 * format that is compatible with OpenAI tool calling. It uses the
 * `zodToJsonSchema` function to convert the schema of the `StructuredTool`
 * or `RunnableToolLike` into a JSON schema, which is then used as the
 * parameters for the OpenAI tool.
 *
 * @param {StructuredToolInterface | Record<string, any> | RunnableToolLike} tool The tool to convert to an OpenAI tool.
 * @returns {ToolDefinition} The inputted tool in OpenAI tool format.
 */
export function convertToOpenAITool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool: StructuredToolInterface | Record<string, any> | RunnableToolLike,
  fields?: {
    /**
     * If `true`, model output is guaranteed to exactly match the JSON Schema
     * provided in the function definition.
     */
    strict?: boolean;
  }
): ToolDefinition {
  let toolDef: ToolDefinition | undefined;
  if (isStructuredTool(tool) || isRunnableToolLike(tool)) {
    toolDef = {
      type: "function",
      function: convertToOpenAIFunction(tool),
    };
  } else {
    toolDef = tool as ToolDefinition;
  }

  if (fields?.strict !== undefined) {
    toolDef.function.strict = fields.strict;
  }

  return tool as ToolDefinition;
}

/**
 * Confirm whether the inputted tool is an instance of `StructuredToolInterface`.
 *
 * @param {StructuredToolInterface | Record<string, any> | undefined} tool The tool to check if it is an instance of `StructuredToolInterface`.
 * @returns {tool is StructuredToolInterface} Whether the inputted tool is an instance of `StructuredToolInterface`.
 */
export function isStructuredTool(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool?: StructuredToolInterface | Record<string, any>
): tool is StructuredToolInterface {
  return (
    tool !== undefined &&
    Array.isArray((tool as StructuredToolInterface).lc_namespace)
  );
}

/**
 * Confirm whether the inputted tool is an instance of `RunnableToolLike`.
 *
 * @param {unknown | undefined} tool The tool to check if it is an instance of `RunnableToolLike`.
 * @returns {tool is RunnableToolLike} Whether the inputted tool is an instance of `RunnableToolLike`.
 */
export function isRunnableToolLike(tool?: unknown): tool is RunnableToolLike {
  return (
    tool !== undefined &&
    Runnable.isRunnable(tool) &&
    "lc_name" in tool.constructor &&
    typeof tool.constructor.lc_name === "function" &&
    tool.constructor.lc_name() === "RunnableToolLike"
  );
}
