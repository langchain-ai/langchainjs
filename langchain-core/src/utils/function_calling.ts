import { zodToJsonSchema } from "zod-to-json-schema";
import {
  StructuredToolInterface,
  StructuredToolParams,
} from "../tools/index.js";
import { FunctionDefinition, ToolDefinition } from "../language_models/base.js";
import { Runnable, RunnableToolLike } from "../runnables/base.js";
import { isZodSchema } from "./types/is_zod_schema.js";

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
    parameters: zodToJsonSchema(tool.schema),
    // Do not include the `strict` field if it is `undefined`.
    ...(fieldsCopy?.strict !== undefined ? { strict: fieldsCopy.strict } : {}),
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
    toolDef.function.strict = fieldsCopy.strict;
  }

  return toolDef;
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

/**
 * Confirm whether or not the tool contains the necessary properties to be considered a `StructuredToolParams`.
 *
 * @param {unknown | undefined} tool The object to check if it is a `StructuredToolParams`.
 * @returns {tool is StructuredToolParams} Whether the inputted object is a `StructuredToolParams`.
 */
export function isStructuredToolParams(
  tool?: unknown
): tool is StructuredToolParams {
  return (
    !!tool &&
    typeof tool === "object" &&
    "name" in tool &&
    "schema" in tool &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isZodSchema(tool.schema as Record<string, any>)
  );
}

/**
 * Whether or not the tool is one of StructuredTool, RunnableTool or StructuredToolParams.
 * It returns `is StructuredToolParams` since that is the most minimal interface of the three,
 * while still containing the necessary properties to be passed to a LLM for tool calling.
 *
 * @param {unknown | undefined} tool The tool to check if it is a LangChain tool.
 * @returns {tool is StructuredToolParams} Whether the inputted tool is a LangChain tool.
 */
export function isLangChainTool(tool?: unknown): tool is StructuredToolParams {
  return (
    isStructuredToolParams(tool) ||
    isRunnableToolLike(tool) ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isStructuredTool(tool as any)
  );
}
