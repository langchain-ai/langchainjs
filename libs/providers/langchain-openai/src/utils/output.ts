import { OpenAI as OpenAIClient } from "openai";
import {
  InteropZodType,
  isZodSchemaV3,
  isZodSchemaV4,
} from "@langchain/core/utils/types";
import { parse as parseV4 } from "zod/v4/core";
import { ResponseFormatJSONSchema } from "openai/resources";
import { zodResponseFormat } from "openai/helpers/zod";
import { ContentBlock, UsageMetadata } from "@langchain/core/messages";
import { toJsonSchema } from "@langchain/core/utils/json_schema";

const SUPPORTED_METHODS = [
  "jsonSchema",
  "functionCalling",
  "jsonMode",
] as const;
type SupportedMethod = (typeof SUPPORTED_METHODS)[number];

/**
 * Get the structured output method for a given model. By default, it uses
 * `jsonSchema` if the model supports it, otherwise it uses `functionCalling`.
 *
 * @throws if the method is invalid, e.g. is not a string or invalid method is provided.
 * @param model - The model name.
 * @param config - The structured output method options.
 * @returns The structured output method.
 */
export function getStructuredOutputMethod(
  model: string,
  method: unknown
): SupportedMethod {
  /**
   * If a method is provided, validate it.
   */
  if (
    typeof method !== "undefined" &&
    !SUPPORTED_METHODS.includes(method as SupportedMethod)
  ) {
    throw new Error(
      `Invalid method: ${method}. Supported methods are: ${SUPPORTED_METHODS.join(
        ", "
      )}`
    );
  }

  const hasSupportForJsonSchema =
    !model.startsWith("gpt-3") &&
    !model.startsWith("gpt-4-") &&
    model !== "gpt-4";

  /**
   * If the model supports JSON Schema, use it by default.
   */
  if (hasSupportForJsonSchema && !method) {
    return "jsonSchema";
  }

  if (!hasSupportForJsonSchema && method === "jsonSchema") {
    throw new Error(
      `JSON Schema is not supported for model "${model}". Please use a different method, e.g. "functionCalling" or "jsonMode".`
    );
  }

  /**
   * If the model does not support JSON Schema, use function calling by default.
   */
  return (method as SupportedMethod) ?? "functionCalling";
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
          schema: toJsonSchema(zodSchema, {
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

/**
 * Handle multi modal response content.
 *
 * @param content The content of the message.
 * @param messages The messages of the response.
 * @returns The new content of the message.
 */
export function handleMultiModalOutput(
  content: string,
  messages: unknown
): ContentBlock[] | string {
  /**
   * Handle OpenRouter image responses
   * @see https://openrouter.ai/docs/features/multimodal/image-generation#api-usage
   */
  if (
    messages &&
    typeof messages === "object" &&
    "images" in messages &&
    Array.isArray(messages.images)
  ) {
    const images = messages.images
      .filter((image) => typeof image?.image_url?.url === "string")
      .map(
        (image) =>
          ({
            type: "image",
            url: image.image_url.url as string,
          } as const)
      );
    return [{ type: "text", text: content }, ...images];
  }

  return content;
}

// TODO: make this a converter
export function _convertOpenAIResponsesUsageToLangChainUsage(
  usage?: OpenAIClient.Responses.ResponseUsage
): UsageMetadata {
  const inputTokenDetails = {
    ...(usage?.input_tokens_details?.cached_tokens != null && {
      cache_read: usage?.input_tokens_details?.cached_tokens,
    }),
  };
  const outputTokenDetails = {
    ...(usage?.output_tokens_details?.reasoning_tokens != null && {
      reasoning: usage?.output_tokens_details?.reasoning_tokens,
    }),
  };
  return {
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
    input_token_details: inputTokenDetails,
    output_token_details: outputTokenDetails,
  };
}
