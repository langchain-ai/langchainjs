import { toJSONSchema, type $ZodType } from "zod/v4/core";
import { dereference, type Schema } from "@cfworker/json-schema";
import {
  isZodSchemaV3,
  isZodSchemaV4,
  InteropZodType,
  interopZodObjectStrict,
  isZodObjectV4,
  interopZodTransformInputSchema,
} from "./types/zod.js";
import {
  type JsonSchema7Type as JSONSchema,
  zodToJsonSchema,
} from "./zod-to-json-schema/index.js";
import { StandardJSONSchemaV1 } from "@standard-schema/spec";
import { isStandardJsonSchema } from "./standard_schema.js";

export { deepCompareStrict, Validator } from "@cfworker/json-schema";

export type ToJSONSchemaParams = NonNullable<
  Parameters<typeof toJSONSchema>[1]
>;

/**
 * WeakMap cache for Zod/Standard-Schema → JSON Schema conversions.
 *
 * Keyed on the schema object reference. Since Zod schemas are immutable and
 * the same `tool.schema` reference is passed on every LLM call, this
 * eliminates redundant serializations. For example, an agent with 6 tools
 * doing 15 steps across 3 parallel subagents would otherwise run 270
 * identical conversions per invocation.
 *
 * Only used when no custom `params` are passed (the common case for tool
 * binding). WeakMap ensures cached entries are GC'd when the schema goes
 * out of scope.
 *
 * @internal
 */
const _jsonSchemaCache = new WeakMap<object, JSONSchema>();

/**
 * Formats that OpenAI-compatible tool/structured-output schemas understand
 * natively. Zod v4 emits a long `pattern` next to these `format` values;
 * providers already enforce the format, and LangChain tools still validate
 * with Zod, so the duplicate regex only inflates prompt tokens.
 *
 * @see https://github.com/langchain-ai/langchainjs/issues/12137
 */
const FORMATS_WITH_REDUNDANT_ZOD_PATTERN = new Set([
  "uuid",
  "date",
  "date-time",
  "email",
]);

/**
 * Recursively drop Zod's redundant `pattern` when a sibling `format` already
 * states the same constraint for well-known string formats.
 *
 * Leaves custom patterns (no matching format), non-standard formats (cuid,
 * ulid, …), and `allOf` pattern lists alone.
 *
 * Mutates `schema` in place. Only intended for schemas produced from Zod.
 *
 * @internal
 */
function stripRedundantZodFormatPatterns(schema: unknown): void {
  if (schema == null || typeof schema !== "object") {
    return;
  }
  if (Array.isArray(schema)) {
    for (const item of schema) {
      stripRedundantZodFormatPatterns(item);
    }
    return;
  }

  const node = schema as Record<string, unknown>;

  if (
    typeof node.format === "string" &&
    FORMATS_WITH_REDUNDANT_ZOD_PATTERN.has(node.format) &&
    "pattern" in node
  ) {
    delete node.pattern;
  }

  for (const key of [
    "properties",
    "patternProperties",
    "$defs",
    "definitions",
    "dependentSchemas",
  ] as const) {
    const map = node[key];
    if (map != null && typeof map === "object" && !Array.isArray(map)) {
      for (const value of Object.values(map as Record<string, unknown>)) {
        stripRedundantZodFormatPatterns(value);
      }
    }
  }

  for (const key of [
    "items",
    "additionalProperties",
    "additionalItems",
    "not",
    "if",
    "then",
    "else",
    "contains",
    "propertyNames",
    "unevaluatedItems",
    "unevaluatedProperties",
  ] as const) {
    if (key in node) {
      stripRedundantZodFormatPatterns(node[key]);
    }
  }

  for (const key of ["anyOf", "oneOf", "allOf", "prefixItems"] as const) {
    const list = node[key];
    if (Array.isArray(list)) {
      for (const item of list) {
        stripRedundantZodFormatPatterns(item);
      }
    }
  }
}

/**
 * Converts a Standard JSON schema, Zod schema or JSON schema to a JSON schema.
 * Results are cached by schema reference when no custom params are passed.
 * @param schema - The schema to convert.
 * @param params - The parameters to pass to the toJSONSchema function.
 * @returns The converted schema.
 */
export function toJsonSchema(
  schema: StandardJSONSchemaV1 | InteropZodType | JSONSchema,
  params?: ToJSONSchemaParams
): JSONSchema {
  // Cache when no custom params are passed (the default for tool binding).
  // Params can change the output (e.g., different target draft), so we
  // bypass the cache when they're provided.
  const canCache = !params && schema != null && typeof schema === "object";

  if (canCache) {
    const cached = _jsonSchemaCache.get(schema);
    if (cached) return cached;
  }

  let result: JSONSchema;

  if (isStandardJsonSchema(schema) && !isZodSchemaV4(schema)) {
    result = schema["~standard"].jsonSchema.input({
      target: "draft-07",
    }) as JSONSchema;
  } else if (isZodSchemaV4(schema)) {
    const inputSchema = interopZodTransformInputSchema(schema, true);
    if (isZodObjectV4(inputSchema)) {
      const strictSchema = interopZodObjectStrict(inputSchema, true);
      result = toJSONSchema(strictSchema as unknown as $ZodType, params);
    } else {
      result = toJSONSchema(schema as unknown as $ZodType, params);
    }
    stripRedundantZodFormatPatterns(result);
  } else if (isZodSchemaV3(schema)) {
    result = zodToJsonSchema(schema as never);
    stripRedundantZodFormatPatterns(result);
  } else {
    result = schema as JSONSchema;
  }

  if (canCache && result != null && typeof result === "object") {
    _jsonSchemaCache.set(schema, result);
  }

  return result;
}

/**
 * Validates if a JSON schema validates only strings. May return false negatives in some edge cases
 * (like recursive or unresolvable refs).
 *
 * @param schema - The schema to validate.
 * @returns `true` if the schema validates only strings, `false` otherwise.
 */
export function validatesOnlyStrings(schema: unknown): boolean {
  // Null, undefined, or empty schema
  if (
    !schema ||
    typeof schema !== "object" ||
    Object.keys(schema).length === 0 ||
    Array.isArray(schema)
  ) {
    return false; // Validates anything, not just strings
  }

  // Explicit type constraint
  if ("type" in schema) {
    if (typeof schema.type === "string") {
      return schema.type === "string";
    }

    if (Array.isArray(schema.type)) {
      // not sure why someone would do `"type": ["string"]` or especially `"type": ["string",
      // "string", "string", ...]` but we're not here to judge
      return schema.type.every((t) => t === "string");
    }
    return false; // Invalid or non-string type
  }

  // Enum with only string values
  if ("enum" in schema) {
    return (
      Array.isArray(schema.enum) &&
      schema.enum.length > 0 &&
      schema.enum.every((val) => typeof val === "string")
    );
  }

  // String constant
  if ("const" in schema) {
    return typeof schema.const === "string";
  }

  // Schema combinations
  if ("allOf" in schema && Array.isArray(schema.allOf)) {
    // If any subschema validates only strings, then the overall schema validates only strings
    return schema.allOf.some((subschema) => validatesOnlyStrings(subschema));
  }

  if (
    ("anyOf" in schema && Array.isArray(schema.anyOf)) ||
    ("oneOf" in schema && Array.isArray(schema.oneOf))
  ) {
    const subschemas = (
      "anyOf" in schema ? schema.anyOf : schema.oneOf
    ) as unknown[];

    // All subschemas must validate only strings
    return (
      subschemas.length > 0 &&
      subschemas.every((subschema) => validatesOnlyStrings(subschema))
    );
  }

  // We're not going to try on this one, it's too complex - we just assume if it has a "not" key and hasn't matched one of the above checks, it's not a string schema.
  if ("not" in schema) {
    return false; // The not case can validate non-strings
  }

  if ("$ref" in schema && typeof schema.$ref === "string") {
    const ref = schema.$ref as string;
    const resolved = dereference(schema as Schema);
    if (resolved[ref]) {
      return validatesOnlyStrings(resolved[ref]);
    }
    return false;
  }

  // ignore recursive refs and other cases where type is omitted for now
  // ignore other cases for now where type is omitted

  return false;
}

// Re-export of the types used throughout langchain for json schema serialization.
// The plan is to eventually nix zod-to-json-schema altogether in place for
// zod v4 / a more standardized way of serializing validated inputs, so its re-exported
// here to remove the dependency on zod-to-json-schema in downstream packages until
// a determination is made.

export {
  type JsonSchema7Type,
  type JsonSchema7Type as JSONSchema,
  type JsonSchema7ArrayType,
  type JsonSchema7ObjectType,
  type JsonSchema7StringType,
  type JsonSchema7NumberType,
  type JsonSchema7NullableType,
} from "./zod-to-json-schema/index.js";
