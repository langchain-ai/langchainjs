import { OpenAI as OpenAIClient } from "openai";

import { ToolCall } from "@langchain/core/messages/tool";
import { ToolDefinition } from "@langchain/core/language_models/base";
import { BindToolsInput } from "@langchain/core/language_models/chat_models";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { DynamicTool } from "@langchain/core/tools";
import { formatToOpenAITool, OpenAIToolChoice } from "./openai.js";

export type ResponsesTool = NonNullable<
  OpenAIClient.Responses.ResponseCreateParams["tools"]
>[number];

export type ResponsesToolChoice = NonNullable<
  OpenAIClient.Responses.ResponseCreateParams["tool_choice"]
>;

export type ChatOpenAIToolType =
  | BindToolsInput
  | OpenAIClient.Chat.ChatCompletionTool
  | ResponsesTool;

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
): OpenAIClient.ChatCompletionTool {
  let toolDef: OpenAIClient.ChatCompletionTool | undefined;

  if (isLangChainTool(tool)) {
    toolDef = formatToOpenAITool(tool);
  } else {
    toolDef = tool as ToolDefinition;
  }

  if (toolDef.type === "function" && fields?.strict !== undefined) {
    toolDef.function.strict = fields.strict;
  }

  return toolDef;
}

export function isBuiltInTool(tool: ChatOpenAIToolType): tool is ResponsesTool {
  return "type" in tool && tool.type !== "function" && tool.type !== "custom";
}

export function isBuiltInToolChoice(
  tool_choice: OpenAIToolChoice | ResponsesToolChoice | undefined
): tool_choice is ResponsesToolChoice {
  return (
    tool_choice != null &&
    typeof tool_choice === "object" &&
    "type" in tool_choice &&
    tool_choice.type !== "function"
  );
}

export type CustomToolCall = ToolCall & {
  call_id: string;
  isCustomTool: true;
};

type LangchainCustomTool = DynamicTool<string> & {
  metadata: {
    customTool: OpenAIClient.Responses.CustomTool;
  };
};

export function isCustomTool(tool: unknown): tool is LangchainCustomTool {
  return (
    typeof tool === "object" &&
    tool !== null &&
    "metadata" in tool &&
    typeof tool.metadata === "object" &&
    tool.metadata !== null &&
    "customTool" in tool.metadata &&
    typeof tool.metadata.customTool === "object" &&
    tool.metadata.customTool !== null
  );
}

export function isOpenAICustomTool(
  tool: ChatOpenAIToolType
): tool is OpenAIClient.Chat.ChatCompletionCustomTool {
  return (
    "type" in tool &&
    tool.type === "custom" &&
    "custom" in tool &&
    typeof tool.custom === "object" &&
    tool.custom !== null
  );
}

export function parseCustomToolCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCall: Record<string, any>
): CustomToolCall | undefined {
  if (rawToolCall.type !== "custom_tool_call") {
    return undefined;
  }
  return {
    ...rawToolCall,
    type: "tool_call",
    call_id: rawToolCall.id,
    id: rawToolCall.call_id,
    name: rawToolCall.name,
    isCustomTool: true,
    args: {
      input: rawToolCall.input,
    },
  };
}

export function isCustomToolCall(
  toolCall: ToolCall
): toolCall is CustomToolCall {
  return (
    toolCall.type === "tool_call" &&
    "isCustomTool" in toolCall &&
    toolCall.isCustomTool === true
  );
}

export function convertCompletionsCustomTool(
  tool: OpenAIClient.Chat.ChatCompletionCustomTool
): OpenAIClient.Responses.CustomTool {
  const getFormat = () => {
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
  };
  return {
    type: "custom",
    name: tool.custom.name,
    description: tool.custom.description,
    format: getFormat(),
  };
}

export function convertResponsesCustomTool(
  tool: OpenAIClient.Responses.CustomTool
): OpenAIClient.Chat.ChatCompletionCustomTool {
  const getFormat = () => {
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
  };
  return {
    type: "custom",
    custom: {
      name: tool.name,
      description: tool.description,
      format: getFormat(),
    },
  };
}
