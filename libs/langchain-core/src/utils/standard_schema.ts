import type {
  StandardSchemaV1,
  StandardJSONSchemaV1,
} from "@standard-schema/spec";

/**
 * A schema that supports both runtime validation and JSON Schema generation.
 * Any schema passed to withStructuredOutput must satisfy both interfaces.
 */
export type SerializableSchema<Input = any, Output = Input> = StandardSchemaV1<
  Input,
  Output
> &
  StandardJSONSchemaV1<Input, Output>;

export function isStandardSchema<Input = any, Output = Input>(
  schema: unknown
): schema is StandardSchemaV1<Input, Output> {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "~standard" in schema &&
    typeof schema["~standard"] === "object" &&
    schema["~standard"] !== null &&
    "validate" in schema["~standard"]
  );
}

/**
 * Type guard for Standard JSON Schema V1. Returns true if the value has a
 * `~standard.jsonSchema` interface, indicating it can be converted to a
 * JSON Schema object (e.g. for sending as a tool definition to an LLM).
 */
export function isStandardJSONSchema<Input = any, Output = Input>(
  schema: unknown
): schema is StandardJSONSchemaV1<Input, Output> {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "~standard" in schema &&
    typeof schema["~standard"] === "object" &&
    schema["~standard"] !== null &&
    "jsonSchema" in schema["~standard"]
  );
}

/**
 * Type guard for Standard Schema V1. Returns true if the value has a
 * `~standard.validate` interface, indicating it can validate unknown
 * values at runtime (e.g. for parsing LLM output).
 */
export function isSerializableSchema<Input = any, Output = Input>(
  schema: unknown
): schema is SerializableSchema<Input, Output> {
  return isStandardSchema(schema) && isStandardJSONSchema(schema);
}
