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
 * ("$ref cannot have keywords {...}"). The conversion in
 * `interopZodResponseFormat` produces exactly that for zod v4 fields whose
 * metadata lives on a wrapper type, e.g. `.default().describe()`: the inner
 * schema is hoisted into `$defs` while `default`/`description` (and the
 * injected `title`) stay behind as siblings of the `$ref`. The same keywords
 * are accepted inline, so merge the referenced definition into the node and
 * drop definitions that end up unreferenced.
 *
 * Post-processing is the only viable layer for this: zod's `override` hook
 * runs before `$defs` assembly so it cannot resolve refs, and switching to
 * `reused: "inline"` would duplicate genuinely reused schemas, breaking
 * parity with OpenAI's native `zodResponseFormat`.
 */
export function inlineRefsWithSiblings(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const defs = (schema.$defs ?? {}) as Record<string, unknown>;

  const refName = (ref: unknown): string | undefined =>
    typeof ref === "string" ? /^#\/\$defs\/(.+)$/.exec(ref)?.[1] : undefined;

  const resolveRef = (ref: unknown): Record<string, unknown> | undefined => {
    const name = refName(ref);
    const target = name === undefined ? undefined : defs[name];
    return target && typeof target === "object"
      ? (target as Record<string, unknown>)
      : undefined;
  };

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    let out = node as Record<string, unknown>;
    if (out.$ref !== undefined && Object.keys(out).length > 1) {
      const target = resolveRef(out.$ref);
      if (target) {
        const { $ref: _ref, ...siblings } = out;
        out = { ...target, ...siblings };
      }
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(out)) {
      result[key] = key === "$defs" ? value : walk(value);
    }
    return result;
  };

  const processed = walk(schema) as Record<string, unknown>;

  const defNames = Object.keys(defs);
  if (defNames.length > 0) {
    // Inline inside the definitions first, so a definition absorbed into
    // another one does not survive pruning as a dead copy in the payload.
    const processedDefs: Record<string, unknown> = {};
    for (const name of defNames) {
      processedDefs[name] = walk(defs[name]);
    }

    // Definitions may reference each other, so resolve reachability from the
    // schema body before dropping anything.
    const referenced = new Set<string>();
    const collect = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(collect);
        return;
      }
      if (!node || typeof node !== "object") return;
      for (const [key, value] of Object.entries(
        node as Record<string, unknown>
      )) {
        if (key === "$ref") {
          const name = refName(value);
          if (name !== undefined && !referenced.has(name)) {
            referenced.add(name);
            collect(processedDefs[name]);
          }
        } else if (key !== "$defs") {
          collect(value);
        }
      }
    };
    collect(processed);

    const kept: Record<string, unknown> = {};
    for (const name of defNames) {
      if (referenced.has(name)) kept[name] = processedDefs[name];
    }
    if (Object.keys(kept).length > 0) processed.$defs = kept;
    else delete processed.$defs;
  }

  return processed;
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
          schema: inlineRefsWithSiblings(
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
            }) as Record<string, unknown>
          ),
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
    ...(usage?.input_tokens_details?.cache_write_tokens != null && {
      cache_creation: usage?.input_tokens_details?.cache_write_tokens,
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
