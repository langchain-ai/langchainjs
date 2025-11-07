import { OpenAI as OpenAIClient } from "openai";
import { Converter } from "@langchain/core/utils/format";
import {
  isOpenAITool as isOpenAIFunctionTool,
  ToolDefinition,
} from "@langchain/core/language_models/base";
import {
  convertToOpenAITool as formatToOpenAITool,
  isLangChainTool,
} from "@langchain/core/utils/function_calling";
import {
  ChatOpenAIToolType,
  isBuiltInTool,
  isCustomTool,
  isOpenAICustomTool,
  OpenAIToolChoice,
  ResponsesTool,
} from "../utils/tools.js";
import { iife } from "@langchain/core/messages";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";

/**
 * Converts an OpenAI Responses API custom tool into an OpenAI Chat Completions custom tool format.
 *
 * This converter transforms custom tools from the Responses API format to the Chat Completions API format.
 * The primary difference between these formats is the structure: Responses API places custom tool
 * properties at the top level, while Chat Completions wraps them in a `custom` object.
 *
 * The converter handles two types of custom tool formats:
 * 1. **Grammar format** - Tools that use a formal grammar definition (e.g., EBNF, JSON Schema)
 *    - Nests the grammar definition and syntax within a `grammar` object
 *    - Restructures the format to match Chat Completions API expectations
 * 2. **Text format** - Tools that accept plain text input
 *    - Preserves the text format type without additional configuration
 *
 * @example
 * ```typescript
 * const responsesTool = {
 *   type: "custom",
 *   name: "calculator",
 *   description: "Performs mathematical calculations",
 *   format: {
 *     type: "grammar",
 *     definition: "expr ::= number ('+' | '-' | '*' | '/') number",
 *     syntax: "ebnf"
 *   }
 * };
 *
 * const completionsTool = convertResponsesCustomToolToCompletionsCustomTool(responsesTool);
 * // Returns:
 * // {
 * //   type: "custom",
 * //   custom: {
 * //     name: "calculator",
 * //     description: "Performs mathematical calculations",
 * //     format: {
 * //       type: "grammar",
 * //       grammar: {
 * //         definition: "expr ::= number ('+' | '-' | '*' | '/') number",
 * //         syntax: "ebnf"
 * //       }
 * //     }
 * //   }
 * // }
 * ```
 */
export const convertResponsesCustomToolToCompletionsCustomTool: Converter<
  OpenAIClient.Responses.CustomTool,
  OpenAIClient.Chat.ChatCompletionCustomTool
> = (tool) => {
  const format = iife(() => {
    if (!tool.format) {
      return undefined;
    }
    if (tool.format.type === "grammar") {
      return {
        type: "grammar" as const,
        grammar: {
          definition: tool.format.definition,
          syntax: tool.format.syntax,
        },
      };
    }
    if (tool.format.type === "text") {
      return {
        type: "text" as const,
      };
    }
    return undefined;
  });
  return {
    type: "custom",
    custom: {
      name: tool.name,
      description: tool.description,
      format,
    },
  };
};

/**
 * Converts an OpenAI Chat Completions custom tool into an OpenAI Responses API custom tool format.
 *
 * This converter transforms custom tools from the Chat Completions API format to the Responses API format.
 * The primary difference between these formats is the structure: Chat Completions wraps custom tool
 * properties in a `custom` object, while Responses API places them at the top level.
 *
 * The converter handles two types of custom tool formats:
 * 1. **Grammar format** - Tools that use a formal grammar definition (e.g., EBNF, JSON Schema)
 *    - Extracts the grammar definition and syntax from the nested structure
 *    - Flattens the format object to match Responses API expectations
 * 2. **Text format** - Tools that accept plain text input
 *    - Preserves the text format type without additional configuration
 *
 * @example
 * ```typescript
 * // Converting a grammar-based custom tool
 * const chatCompletionTool = {
 *   type: "custom",
 *   custom: {
 *     name: "json_parser",
 *     description: "Parses JSON according to schema",
 *     format: {
 *       type: "grammar",
 *       grammar: {
 *         definition: "{ \"type\": \"object\" }",
 *         syntax: "json_schema"
 *       }
 *     }
 *   }
 * };
 *
 * const responsesTool = convertCompletionsCustomToolToResponsesCustomTool(chatCompletionTool);
 * // Result:
 * // {
 * //   type: "custom",
 * //   name: "json_parser",
 * //   description: "Parses JSON according to schema",
 * //   format: {
 * //     type: "grammar",
 * //     definition: "{ \"type\": \"object\" }",
 * //     syntax: "json_schema"
 * //   }
 * // }
 * ```
 */
export const convertCompletionsCustomToolToResponsesCustomTool: Converter<
  OpenAIClient.Chat.ChatCompletionCustomTool,
  OpenAIClient.Responses.CustomTool
> = (tool) => {
  const format = iife(() => {
    if (!tool.custom.format) {
      return undefined;
    }
    if (tool.custom.format.type === "grammar") {
      return {
        type: "grammar" as const,
        definition: tool.custom.format.grammar.definition,
        syntax: tool.custom.format.grammar.syntax,
      };
    }
    if (tool.custom.format.type === "text") {
      return {
        type: "text" as const,
      };
    }
    return undefined;
  });
  return {
    type: "custom",
    name: tool.custom.name,
    description: tool.custom.description,
    format,
  };
};

/**
 * Converts an array of various tool types into OpenAI Responses API compatible tool definitions.
 *
 * This converter handles the transformation of different tool formats used across LangChain and OpenAI
 * into the standardized format required by the OpenAI Responses API. It processes multiple tool types
 * and applies necessary configurations based on the streaming and strict mode settings.
 *
 * The converter handles four distinct tool types:
 * 1. **Built-in tools** - OpenAI native tools like image_generation, file_search, etc.
 * 2. **Custom tools** - LangChain custom tools with metadata containing custom tool definitions
 * 3. **Function tools** - Standard OpenAI function calling tools with JSON Schema parameters
 * 4. **OpenAI custom tools** - Custom tools in OpenAI Chat Completions format
 *
 * @param params - The conversion parameters
 * @param params.tools - Array of tools to convert. Can include:
 *   - Built-in OpenAI tools (ResponsesTool) - Used directly with potential streaming adjustments
 *   - LangChain custom tools (DynamicTool with customTool metadata) - Converted to Responses custom tool format
 *   - OpenAI function tools (ToolDefinition) - Converted to Responses function tool format with strict mode support
 *   - OpenAI custom tools (ChatCompletionCustomTool) - Converted using dedicated converter
 * @param params.stream - Optional. If `true`, enables streaming mode which may require special handling
 *                        for certain tool types (e.g., image_generation tools require partial_images setting)
 * @param params.strict - Optional. If `true`, enables strict mode for function tools, guaranteeing that
 *                        model output exactly matches the JSON Schema. If `false` or undefined, sets to null.
 *
 * @returns An array of ResponsesTool objects formatted for use with the OpenAI Responses API
 *
 * @remarks
 * - For image_generation tools in streaming mode, automatically sets `partial_images` to 1 to prevent
 *   OpenAI API errors. This is required by the API but partial image support is not yet implemented.
 * - The strict parameter only applies to function tools and is set to null when not explicitly enabled.
 * - Custom tools are extracted from LangChain tool metadata and reformatted to match the Responses API schema.
 * - OpenAI custom tools in Chat Completions format are converted using a dedicated converter function.
 *
 * @example
 * ```typescript
 * // Converting a mix of tool types
 * const tools = [
 *   // Built-in tool
 *   { type: "image_generation", name: "dall-e" },
 *
 *   // LangChain custom tool
 *   new DynamicTool({
 *     name: "custom_parser",
 *     metadata: {
 *       customTool: {
 *         name: "custom_parser",
 *         description: "Parses custom format",
 *         format: { type: "text" }
 *       }
 *     }
 *   }),
 *
 *   // Function tool
 *   {
 *     type: "function",
 *     function: {
 *       name: "get_weather",
 *       description: "Get weather data",
 *       parameters: { type: "object", properties: {} }
 *     }
 *   }
 * ];
 *
 * const responsesTools = convertToolsInputToResponsesTools({
 *   tools,
 *   stream: true,
 *   strict: true
 * });
 * ```
 */
export const convertToolsInputToResponsesTools: Converter<
  { tools: ChatOpenAIToolType[]; stream?: boolean; strict?: boolean },
  ResponsesTool[]
> = ({ tools, stream, strict }) => {
  const reducedTools: ResponsesTool[] = [];
  for (const tool of tools) {
    if (isBuiltInTool(tool)) {
      if (tool.type === "image_generation" && stream) {
        // OpenAI sends a 400 error if partial_images is not set and we want to stream.
        // We also set it to 1 since we don't support partial images yet.
        tool.partial_images = 1;
      }
      reducedTools.push(tool);
    } else if (isCustomTool(tool)) {
      const customToolData = tool.metadata.customTool;
      reducedTools.push({
        type: "custom",
        name: customToolData.name,
        description: customToolData.description,
        format: customToolData.format,
      } as ResponsesTool);
    } else if (isOpenAIFunctionTool(tool)) {
      reducedTools.push({
        type: "function",
        name: tool.function.name,
        parameters: tool.function.parameters,
        description: tool.function.description,
        strict: strict ?? null,
      });
    } else if (isOpenAICustomTool(tool)) {
      reducedTools.push(
        convertCompletionsCustomToolToResponsesCustomTool(tool)
      );
    }
  }
  return reducedTools;
};

/**
 * Converts a tool input (either a LangChain tool or an OpenAI tool definition) into
 * an OpenAI ChatCompletionTool format suitable for use with the Chat Completions API.
 *
 * This converter handles two types of input:
 * 1. LangChain tools (StructuredToolInterface) - converted using formatToOpenAITool
 * 2. OpenAI tool definitions (ToolDefinition) - used directly with type assertion
 *
 * The converter also supports setting the `strict` parameter on the function definition,
 * which when enabled, guarantees that the model output will exactly match the JSON Schema
 * provided in the function definition.
 *
 * @param params - The conversion parameters
 * @param params.input - The tool to convert. Can be either a LangChain tool or an OpenAI tool definition
 * @param params.strict - Optional. If `true`, model output is guaranteed to exactly match the JSON Schema
 *                        provided in the function definition. If `false` or undefined, the strict mode is not enforced.
 *
 * @returns An OpenAI ChatCompletionTool object formatted for use with the Chat Completions API
 *
 * @example
 * ```typescript
 * // Converting a LangChain tool
 * const langchainTool = new DynamicTool({
 *   name: "calculator",
 *   description: "Performs calculations",
 *   func: async (input) => String(eval(input))
 * });
 * const completionTool = convertBindToolsInputToCompletionsTools({
 *   input: langchainTool,
 *   strict: true
 * });
 *
 * // Converting an OpenAI tool definition
 * const openaiTool = {
 *   type: "function",
 *   function: {
 *     name: "get_weather",
 *     description: "Get the current weather",
 *     parameters: { type: "object", properties: {} }
 *   }
 * };
 * const completionTool = convertBindToolsInputToCompletionsTools({
 *   input: openaiTool,
 *   strict: false
 * });
 * ```
 */
export const convertBindToolsInputToCompletionsTools: Converter<
  { input: BindToolsInput; strict?: boolean },
  OpenAIClient.ChatCompletionTool
> = ({ input, strict }) => {
  let toolDef: OpenAIClient.ChatCompletionTool | undefined;

  if (isLangChainTool(input)) {
    toolDef = formatToOpenAITool(input);
  } else {
    toolDef = input as ToolDefinition;
  }

  if (strict !== undefined) toolDef.function.strict = strict;

  return toolDef;
};

export const convertToolsInputToCompletionsTools: Converter<
  { tools: ChatOpenAIToolType[]; strict?: boolean },
  OpenAIClient.ChatCompletionTool[]
> = ({ tools, strict }) => {
  return tools.map((tool) => {
    if (isCustomTool(tool)) {
      return convertResponsesCustomToolToCompletionsCustomTool(
        tool.metadata.customTool
      );
    }
    if (isOpenAIFunctionTool(tool)) {
      if (strict !== undefined) {
        return {
          ...tool,
          function: {
            ...tool.function,
            strict,
          },
        };
      }

      return tool;
    }
    return convertBindToolsInputToCompletionsTools({ input: tool, strict });
  });
};

/**
 * Converts a tool choice parameter into the format expected by OpenAI's Chat Completions API.
 *
 * This converter handles the transformation of various tool choice formats into the standardized
 * `ChatCompletionToolChoiceOption` type used by the OpenAI Chat Completions API. It supports
 * multiple input formats including string literals, function names, and pre-formatted objects.
 *
 * @param toolChoice - The tool choice parameter to convert. Can be:
 *                     - A string literal: "any", "required", "auto", "none"
 *                     - A function name as a string
 *                     - A pre-formatted ChatCompletionToolChoiceOption object
 */
export const convertToolChoiceToCompletionsToolChoice: Converter<
  OpenAIToolChoice | undefined,
  OpenAIClient.ChatCompletionToolChoiceOption | undefined
> = (toolChoice) => {
  if (!toolChoice) {
    return undefined;
  } else if (toolChoice === "any" || toolChoice === "required") {
    return "required";
  } else if (toolChoice === "auto") {
    return "auto";
  } else if (toolChoice === "none") {
    return "none";
  } else if (typeof toolChoice === "string") {
    return {
      type: "function",
      function: { name: toolChoice },
    };
  } else {
    return toolChoice;
  }
};
