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
const REFUSAL_STOP_REASON = "content_filtered";
const TOKEN_LIMIT_STOP_REASON = "max_tokens";

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

function toConverseOutputSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => toConverseOutputSchema(item));
  }
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }
  const supported = Object.entries(schema).filter(
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

function hasStopReason(metadata: unknown, stopReason: string): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "stopReason" in metadata &&
    metadata.stopReason === stopReason
  );
}

function stoppedWith(message: BaseMessage, stopReason: string): boolean {
  const metadata: object = message.response_metadata;
  const streamStop = "messageStop" in metadata ? metadata.messageStop : null;
  return (
    hasStopReason(metadata, stopReason) || hasStopReason(streamStop, stopReason)
  );
}

/**
 * A refused or truncated response reaches Converse callers as a success, so
 * without this check it surfaces as a JSON parsing error. The stop reason sits
 * at the top of the metadata on `Converse` and under `messageStop` on
 * `ConverseStream`.
 */
export function throwIfOutputIncomplete(message: BaseMessage): void {
  if (stoppedWith(message, REFUSAL_STOP_REASON)) {
    throw new Error(
      `Bedrock refused to produce the structured output (stopReason: ${REFUSAL_STOP_REASON}).`
    );
  }
  if (stoppedWith(message, TOKEN_LIMIT_STOP_REASON)) {
    throw new Error(
      `Bedrock cut the structured output at the token limit (stopReason: ${TOKEN_LIMIT_STOP_REASON}). Increase \`maxTokens\`.`
    );
  }
}
