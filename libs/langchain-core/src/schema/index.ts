import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { JSONSchema7 } from "json-schema";
import { zodSerializer } from "./vendors/index.js";

export type $SchemaSerializer = (
  schema: StandardSerializableSchemaV1
) => Promise<JSONSchema7>;

export interface StandardSerializableSchemaV1<Input = unknown, Output = Input>
  extends StandardSchemaV1<Input, Output> {
  "~standard-json": never;
}

export async function standardValidate<T extends StandardSchemaV1>(
  schema: T,
  input: StandardSchemaV1.InferInput<T>
): Promise<StandardSchemaV1.InferOutput<T>> {
  const result = await schema["~standard"].validate(input);

  // if the `issues` field exists, the validation failed
  if (result.issues) {
    throw new Error(JSON.stringify(result.issues, null, 2));
  }
  return result.value;
}

export async function standardSerialize(
  schema: StandardSerializableSchemaV1
): Promise<JSONSchema7> {
  const vendor = schema["~standard"].vendor;
  switch (vendor) {
    case "zod":
      return zodSerializer(schema);
    default:
      throw new Error(`langchain: Unsupported schema vendor ${vendor}`);
  }
}
