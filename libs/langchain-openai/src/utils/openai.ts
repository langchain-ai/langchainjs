import {
  APIConnectionTimeoutError,
  APIUserAbortError,
  OpenAI as OpenAIClient,
} from "openai";
import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  convertToOpenAIFunction,
  convertToOpenAITool,
} from "@langchain/core/utils/function_calling";
import { ToolDefinition } from "@langchain/core/language_models/base";
import {
  InteropZodType,
  isInteropZodSchema,
  isZodSchemaV3,
  isZodSchemaV4,
} from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { toJSONSchema as toJSONSchemaV4, parse as parseV4 } from "zod/v4/core";
import { ResponseFormatJSONSchema } from "openai/resources";
import { zodResponseFormat } from "openai/helpers/zod";
import { addLangChainErrorFields } from "./errors.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapOpenAIClientError(e: any) {
  let error;
  if (e.constructor.name === APIConnectionTimeoutError.name) {
    error = new Error(e.message);
    error.name = "TimeoutError";
  } else if (e.constructor.name === APIUserAbortError.name) {
    error = new Error(e.message);
    error.name = "AbortError";
  } else if (e.status === 400 && e.message.includes("tool_calls")) {
    error = addLangChainErrorFields(e, "INVALID_TOOL_RESULTS");
  } else if (e.status === 401) {
    error = addLangChainErrorFields(e, "MODEL_AUTHENTICATION");
  } else if (e.status === 429) {
    error = addLangChainErrorFields(e, "MODEL_RATE_LIMIT");
  } else if (e.status === 404) {
    error = addLangChainErrorFields(e, "MODEL_NOT_FOUND");
  } else {
    error = e;
  }
  return error;
}

export {
  convertToOpenAIFunction as formatToOpenAIFunction,
  convertToOpenAITool as formatToOpenAITool,
};

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

// inlined from openai/lib/parser.ts
function makeParseableResponseFormat<ParsedT>(
  response_format: ResponseFormatJSONSchema,
  parser: (content: string) => ParsedT
) {
  const obj = { ...response_format };

  Object.defineProperties(obj, {
    $brand: {
      value: "auto-parseable-response-format",
      enumerable: false,
    },
    $parseRaw: {
      value: parser,
      enumerable: false,
    },
  });

  return obj;
}

export function interopZodResponseFormat(
  zodSchema: InteropZodType,
  name: string,
  props: Omit<ResponseFormatJSONSchema.JSONSchema, "schema" | "strict" | "name">
) {
  if (isZodSchemaV3(zodSchema)) {
    return zodResponseFormat(zodSchema, name, props);
  }
  if (isZodSchemaV4(zodSchema)) {
    return makeParseableResponseFormat(
      {
        type: "json_schema",
        json_schema: {
          ...props,
          name,
          strict: true,
          schema: toJSONSchemaV4(zodSchema, {
            cycles: "ref", // equivalent to nameStrategy: 'duplicate-ref'
            reused: "ref", // equivalent to $refStrategy: 'extract-to-root'
            override(ctx) {
              ctx.jsonSchema.title = name; // equivalent to `name` property
              // TODO: implement `nullableStrategy` patch-fix (zod doesn't support openApi3 json schema target)
              // TODO: implement `openaiStrictMode` patch-fix (where optional properties without `nullable` are not supported)
            },
            /// property equivalents from native `zodResponseFormat` fn
            // openaiStrictMode: true,
            // name,
            // nameStrategy: 'duplicate-ref',
            // $refStrategy: 'extract-to-root',
            // nullableStrategy: 'property',
          }),
        },
      },
      (content) => parseV4(zodSchema, JSON.parse(content))
    );
  }
  throw new Error("Unsupported schema response format");
}
