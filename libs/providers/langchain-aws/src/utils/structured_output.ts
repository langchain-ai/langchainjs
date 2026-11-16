import type {
  OutputConfig,
  Tool as BedrockTool,
} from "@aws-sdk/client-bedrock-runtime";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";

const UNSUPPORTED_SCHEMA_KEYWORDS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "maxItems",
]);
const MAX_SUPPORTED_MIN_ITEMS = 1;
const SUBSCHEMA_MAP_KEYWORDS = new Set(["properties", "$defs", "definitions"]);
const LITERAL_VALUE_KEYWORDS = new Set([
  "const",
  "default",
  "enum",
  "examples",
]);
const MERGEABLE_OBJECT_KEYWORDS = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "title",
  "description",
]);
const REFUSAL_STOP_REASONS = new Set(["content_filtered"]);
const TOKEN_LIMIT_STOP_REASONS = new Set(["max_tokens", "length"]);

function isUnsupportedKeyword(keyword: string, value: unknown): boolean {
  if (keyword === "minItems") {
    return typeof value === "number" && value > MAX_SUPPORTED_MIN_ITEMS;
  }
  return UNSUPPORTED_SCHEMA_KEYWORDS.has(keyword);
}

function convertSubschemaMap(subschemas: object): Record<string, unknown> {
  const converted = Object.entries(subschemas).map(([name, subschema]) => [
    name,
    toConverseOutputSchema(subschema),
  ]);
  return Object.fromEntries(converted);
}

function convertKeywordValue(keyword: string, value: unknown): unknown {
  if (LITERAL_VALUE_KEYWORDS.has(keyword)) {
    return value;
  }
  if (
    SUBSCHEMA_MAP_KEYWORDS.has(keyword) &&
    typeof value === "object" &&
    value !== null
  ) {
    return convertSubschemaMap(value);
  }
  return toConverseOutputSchema(value);
}

function describesObject(schema: Record<string, unknown>): boolean {
  const { type } = schema;
  if (type === undefined) {
    return "properties" in schema;
  }
  return Array.isArray(type) ? type.includes("object") : type === "object";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMergeableObjectBranch(
  branch: unknown
): branch is Record<string, unknown> {
  if (!isRecord(branch)) {
    return false;
  }
  const keywords = Object.keys(branch);
  return (
    describesObject(branch) &&
    typeof branch.additionalProperties !== "object" &&
    keywords.every((keyword) => MERGEABLE_OBJECT_KEYWORDS.has(keyword))
  );
}

function mergeProperties(
  branches: Record<string, unknown>[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const branch of branches) {
    const properties = isRecord(branch.properties) ? branch.properties : {};
    for (const [name, property] of Object.entries(properties)) {
      const existing = merged[name];
      merged[name] =
        existing === undefined ? property : { allOf: [existing, property] };
    }
  }
  return merged;
}

function mergeRequired(branches: Record<string, unknown>[]): string[] {
  const required = branches.flatMap((branch) => {
    const names: unknown[] = Array.isArray(branch.required)
      ? branch.required
      : [];
    return names.filter((name) => typeof name === "string");
  });
  return [...new Set(required)];
}

/**
 * Bedrock requires every object to be closed, and closing each branch of an
 * `allOf` on its own forbids the keys of the other branches. An intersection of
 * plain objects becomes one object instead, which can be closed safely.
 */
function mergeObjectIntersection(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const { allOf, ...rest } = schema;
  if (!Array.isArray(allOf) || !allOf.every(isMergeableObjectBranch)) {
    return schema;
  }
  return {
    ...rest,
    type: "object",
    properties: mergeProperties(allOf),
    required: mergeRequired(allOf),
  };
}

function toConverseOutputSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => toConverseOutputSchema(item));
  }
  if (!isRecord(schema)) {
    return schema;
  }
  const merged = mergeObjectIntersection(schema);
  const supported = Object.entries(merged).filter(
    ([keyword, value]) => !isUnsupportedKeyword(keyword, value)
  );
  const converted = Object.fromEntries(
    supported.map(([keyword, value]) => [
      keyword,
      convertKeywordValue(keyword, value),
    ])
  );
  if (
    !describesObject(converted) ||
    typeof converted.additionalProperties === "object"
  ) {
    return converted;
  }
  return { ...converted, additionalProperties: false };
}

/**
 * Builds the Converse `outputConfig` that holds the model's text response to a
 * JSON schema.
 *
 * Keywords that Bedrock rejects with a 400 are removed, and every object gets
 * `additionalProperties: false`, which Bedrock requires. A schema-valued
 * `additionalProperties` stays as it is: rewriting it would silently turn a
 * record into an empty object, while Bedrock rejects it with a clear error.
 */
export function convertToConverseOutputConfig(
  name: string,
  schema: object,
  description?: string
): OutputConfig {
  return {
    textFormat: {
      type: "json_schema",
      structure: {
        jsonSchema: {
          name,
          description,
          schema: JSON.stringify(toConverseOutputSchema(schema)),
        },
      },
    },
  };
}

/**
 * Declares the tools called earlier in a conversation. Bedrock rejects
 * `toolUse` blocks in a request without a `toolConfig`, and a request that uses
 * `outputConfig` binds no tools of its own.
 */
export function toolsFromMessageHistory(
  messages: BaseMessage[]
): BedrockTool[] {
  const toolCalls = messages.flatMap((message) => {
    return AIMessage.isInstance(message) ? (message.tool_calls ?? []) : [];
  });
  const names = new Set(toolCalls.map((toolCall) => toolCall.name));
  return [...names].map((name) => ({
    toolSpec: {
      name,
      description: "Already called earlier in this conversation.",
      inputSchema: { json: { type: "object" } },
    },
  }));
}

function readField(container: unknown, field: string): unknown {
  return isRecord(container) ? container[field] : undefined;
}

function readStopReason(message: BaseMessage): unknown {
  const metadata = message.response_metadata;
  const streamStop = readField(metadata, "messageStop");
  return (
    readField(metadata, "stopReason") ??
    readField(streamStop, "stopReason") ??
    readField(metadata, "finish_reason")
  );
}

/**
 * A refused or truncated response reaches Converse callers as a success, so
 * without this check it surfaces as a JSON parsing error, or as a valid result
 * when the partial text happens to parse. The stop reason sits at the top of
 * the metadata on `Converse`, under `messageStop` on `ConverseStream`, and in
 * `finish_reason`, mapped to the standard values, on the stream-event path.
 *
 * `guardrail_intervened` is not a refusal: a guardrail that masks PII reports
 * it too, with a usable response whose values are replaced by placeholders. A
 * blocking guardrail returns its configured message, which fails parsing. The
 * standard `content_filter` covers both, so it is not a refusal either.
 */
export function throwIfOutputIncomplete(message: BaseMessage): void {
  const stopReason = readStopReason(message);
  if (typeof stopReason !== "string") {
    return;
  }
  if (REFUSAL_STOP_REASONS.has(stopReason)) {
    throw new Error(
      `Bedrock refused to produce the structured output (stopReason: ${stopReason}).`
    );
  }
  if (TOKEN_LIMIT_STOP_REASONS.has(stopReason)) {
    throw new Error(
      `Bedrock cut the structured output at the token limit (stopReason: ${stopReason}). Increase \`maxTokens\`.`
    );
  }
}
