import { OpenAI as OpenAIClient } from "openai";
import {
  InteropZodType,
  isZodSchemaV3,
  isZodSchemaV4,
} from "@langchain/core/utils/types";
import { parse as parseV4, type $ZodType } from "zod/v4/core";
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

/**
 * OpenAI strict mode rejects `$ref` nodes that carry sibling keywords
 * ("$ref cannot have keywords"). zod v4's `toJSONSchema` with
 * `cycles: "ref"` / `reused: "ref"` can emit exactly that: a field written
 * `.default().describe()` gets hoisted into `$defs`, while the referencing
 * node keeps `default` / `description` / `title` as siblings of the `$ref`.
 *
 * The reversed chain (`.describe().default()`) keeps the field inline and is
 * accepted by strict mode, so inlining the `$defs` target into the
 * referencing node — merging the sibling keywords — produces the accepted
 * shape.
 *
 * @internal
 */
export function inlineRefSiblings(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const defs = (schema.$defs ?? schema.definitions) as
    | Record<string, unknown>
    | undefined;
  return _inlineRefSiblings(schema, defs, new Set()) as Record<string, unknown>;
}

function _inlineRefSiblings(
  node: unknown,
  defs: Record<string, unknown> | undefined,
  expanding: Set<string>
): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => _inlineRefSiblings(item, defs, expanding));
  }
  if (typeof node !== "object" || node === null) {
    return node;
  }

  const obj = node as Record<string, unknown>;

  // A `$ref` with sibling keywords: inline the `$defs` target so strict
  // mode accepts the node. Skip when the target is already being expanded
  // (recursive refs would loop forever) or cannot be resolved.
  if (typeof obj.$ref === "string" && Object.keys(obj).length > 1 && defs) {
    const refKey = obj.$ref.split("/").pop() ?? "";
    const target = defs[refKey];
    if (target != null && !expanding.has(refKey)) {
      const nextExpanding = new Set(expanding).add(refKey);
      const inlined = _inlineRefSiblings(target, defs, nextExpanding);
      if (typeof inlined === "object" && inlined !== null) {
        const siblings = { ...obj };
        delete siblings.$ref;
        return { ...(inlined as Record<string, unknown>), ...siblings };
      }
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "$defs" || key === "definitions") {
      // Recurse into individual definitions so refs inside `$defs` are also
      // handled, but keep the container itself.
      if (typeof value === "object" && value !== null) {
        const processed: Record<string, unknown> = {};
        for (const [defKey, defValue] of Object.entries(
          value as Record<string, unknown>
        )) {
          processed[defKey] = _inlineRefSiblings(defValue, defs, expanding);
        }
        result[key] = processed;
      } else {
        result[key] = value;
      }
      continue;
    }
    result[key] = _inlineRefSiblings(value, defs, expanding);
  }
  return result;
}

export function interopZodResponseFormat(
  zodSchema: InteropZodType,
  name: string,
  props: Omit<ResponseFormatJSONSchema.JSONSchema, "schema" | "strict" | "name">
) {
  if (isZodSchemaV3(zodSchema)) {
    return zodResponseFormat(zodSchema as never, name, props);
  }
  if (isZodSchemaV4(zodSchema)) {
    return makeParseableResponseFormat(
      {
        type: "json_schema",
        json_schema: {
          ...props,
          name,
          strict: true,
          schema: inlineRefSiblings(
            toJsonSchema(zodSchema, {
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
            })
          ) as ResponseFormatJSONSchema.JSONSchema,
        },
      },
      (content) =>
        parseV4(zodSchema as unknown as $ZodType, JSON.parse(content))
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
          }) as const
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
