import {
  APIConnectionTimeoutError,
  APIUserAbortError,
  OpenAI as OpenAIClient,
} from "openai";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { ToolDefinition } from "@langchain/core/language_models/base";
import { isInteropZodSchema } from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { addLangChainErrorFields } from "./errors.js";

export function wrapOpenAIClientError(e: unknown) {
  if (!e || typeof e !== "object") {
    return e;
  }

  let error;
  if (
    e.constructor.name === APIConnectionTimeoutError.name &&
    'message' in e && typeof e.message === 'string'
  ) {
    error = new Error(e.message);
    error.name = "TimeoutError";
  } else if (
    e.constructor.name === APIUserAbortError.name &&
    'message' in e && typeof e.message === 'string'
  ) {
    error = new Error(e.message);
    error.name = "AbortError";
  } else if (
    'status' in e && e.status === 400 &&
    'message' in e && typeof e.message === 'string' && e.message.includes("tool_calls")
  ) {
    error = addLangChainErrorFields(e, "INVALID_TOOL_RESULTS");
  } else if ('status' in e && e.status === 401) {
    error = addLangChainErrorFields(e, "MODEL_AUTHENTICATION");
  } else if ('status' in e && e.status === 429) {
    error = addLangChainErrorFields(e, "MODEL_RATE_LIMIT");
  } else if ('status' in e && e.status === 404) {
    error = addLangChainErrorFields(e, "MODEL_NOT_FOUND");
  } else {
    error = e;
  }
  return error;
}

export function formatToOpenAIAssistantTool(
  tool: StructuredToolInterface
): ToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: isInteropZodSchema(tool.schema)
        ? toJsonSchema(tool.schema)
        : tool.schema,
    },
  };
}

export type OpenAIToolChoice =
  | OpenAIClient.ChatCompletionToolChoiceOption
  | "any"
  | string;

export function formatToOpenAIToolChoice(
  toolChoice?: OpenAIToolChoice
): OpenAIClient.ChatCompletionToolChoiceOption | undefined {
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
      function: {
        name: toolChoice,
      },
    };
  } else {
    return toolChoice;
  }
}
