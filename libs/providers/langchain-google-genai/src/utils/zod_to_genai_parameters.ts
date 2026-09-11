import {
  type FunctionDeclarationSchema as GenerativeAIFunctionDeclarationSchema,
  type SchemaType as FunctionDeclarationSchemaType,
} from "@google/generative-ai";
import {
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  type JsonSchema7Type,
  toJsonSchema,
} from "@langchain/core/utils/json_schema";
import {
  isSerializableSchema,
  SerializableSchema,
} from "@langchain/core/utils/standard_schema";

export interface GenerativeAIJsonSchema extends Record<string, unknown> {
  properties?: Record<string, GenerativeAIJsonSchema>;
  type: FunctionDeclarationSchemaType;
}

export interface GenerativeAIJsonSchemaDirty extends GenerativeAIJsonSchema {
  properties?: Record<string, GenerativeAIJsonSchemaDirty>;
  additionalProperties?: boolean;
}

/**
 * Gemini's Schema proto `type` is a single enum, not a repeating field.
 * JSON Schema (and Zod 3 via zod-to-json-schema) often emit list-valued
 * `type` such as `["string","null"]`, which the API rejects with
 * "Proto field is not repeating, cannot start list".
 *
 * Same rewrite as `adjustObjectType` in `@langchain/google-common` and
 * `@langchain/google`.
 */
function adjustObjectType(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  if (!Array.isArray(obj.type)) {
    return obj;
  }

  const len = obj.type.length;
  const nullIndex = obj.type.indexOf("null");
  if (len === 2 && nullIndex >= 0) {
    // There are only two values set for the type, and one of them is "null".
    // Set the type to the other one and set nullable to true.
    const typeIndex = nullIndex === 0 ? 1 : 0;
    obj.type = obj.type[typeIndex];
    obj.nullable = true;
  } else if (len === 1 && nullIndex === 0) {
    // This is nullable only without a type, which doesn't
    // make sense for Gemini
    throw new Error("zod_to_genai_parameters: Gemini cannot handle null type");
  } else if (len === 1) {
    // Although an array, it has only one value.
    // So set it to the string to match what Gemini expects.
    obj.type = obj.type[0];
  } else {
    // Anything else could be a union type, so reject it.
    throw new Error(
      "zod_to_genai_parameters: Gemini cannot handle union types"
    );
  }
  return obj;
}

export function removeAdditionalProperties(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>
): GenerativeAIJsonSchema {
  if (typeof obj === "object" && obj !== null) {
    const newObj = { ...obj };

    if ("additionalProperties" in newObj) {
      delete newObj.additionalProperties;
    }
    if ("$schema" in newObj) {
      delete newObj.$schema;
    }
    if ("strict" in newObj) {
      delete newObj.strict;
    }

    // Zod / JSON Schema sometimes make `type` an array (e.g. `.nullable()`),
    // which needs cleaning up before we recurse into nested schemas.
    adjustObjectType(newObj);

    for (const key in newObj) {
      if (key in newObj) {
        if (Array.isArray(newObj[key])) {
          newObj[key] = newObj[key].map(removeAdditionalProperties);
        } else if (typeof newObj[key] === "object" && newObj[key] !== null) {
          newObj[key] = removeAdditionalProperties(newObj[key]);
        }
      }
    }

    return newObj as GenerativeAIJsonSchema;
  }

  return obj as GenerativeAIJsonSchema;
}

export function schemaToGenerativeAIParameters<
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>,
>(
  schema:
    | SerializableSchema<RunOutput>
    | InteropZodType<RunOutput>
    | JsonSchema7Type
): GenerativeAIFunctionDeclarationSchema {
  // GenerativeAI doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  // Zod sometimes also makes an array of type (because of .nullable()/.nullish()),
  // which needs cleaning up.
  const jsonSchema = removeAdditionalProperties(
    isInteropZodSchema(schema) || isSerializableSchema(schema)
      ? toJsonSchema(schema)
      : schema
  );
  const { $schema, ...rest } = jsonSchema;
  return rest as GenerativeAIFunctionDeclarationSchema;
}

export function jsonSchemaToGeminiParameters(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>
): GenerativeAIFunctionDeclarationSchema {
  // Gemini doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  const jsonSchema = removeAdditionalProperties(
    schema as GenerativeAIJsonSchemaDirty
  );
  const { $schema, ...rest } = jsonSchema;

  return rest as GenerativeAIFunctionDeclarationSchema;
}
