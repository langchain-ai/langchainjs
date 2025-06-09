import type { z } from "zod";
import { type JsonSchema7Type, zodToJsonSchema } from "zod-to-json-schema";
import { dereference, type Schema } from "@cfworker/json-schema";
import { isZodSchema } from "./types/is_zod_schema.js";

export type JSONSchema = JsonSchema7Type;

export { deepCompareStrict, Validator } from "@cfworker/json-schema";

/**
 * Converts a Zod schema or JSON schema to a JSON schema.
 * @param schema - The schema to convert.
 * @returns The converted schema.
 */
export function toJsonSchema(schema: z.ZodType | JSONSchema): JSONSchema {
  if (isZodSchema(schema)) {
    return zodToJsonSchema(schema) as JSONSchema;
  }
  return schema;
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
