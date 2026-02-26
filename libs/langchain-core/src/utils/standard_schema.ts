import type {
  StandardSchemaV1,
  StandardJSONSchemaV1,
} from "@standard-schema/spec";

/**
 * A schema that supports both runtime validation and JSON Schema generation.
 * Any schema passed to withStructuredOutput must satisfy both interfaces.
 */
export type SerializableSchema<
  Input = unknown,
  Output = Input,
> = StandardSchemaV1<Input, Output> & StandardJSONSchemaV1<Input, Output>;

export function isStandardSchema<Input = unknown, Output = Input>(
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

export function isStandardJSONSchema<Input = unknown, Output = Input>(
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

export function isSerializableSchema<Input = unknown, Output = Input>(
  schema: unknown
): schema is SerializableSchema<Input, Output> {
  return isStandardSchema(schema) && isStandardJSONSchema(schema);
}
