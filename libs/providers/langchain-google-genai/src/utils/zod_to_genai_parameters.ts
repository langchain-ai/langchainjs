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

function removeExclusiveBounds(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>
) {
  const isInteger = obj.type === "integer";

  if ("exclusiveMinimum" in obj) {
    const { exclusiveMinimum } = obj;
    delete obj.exclusiveMinimum;

    if (typeof exclusiveMinimum === "number" && !("minimum" in obj)) {
      obj.minimum = isInteger
        ? Math.floor(exclusiveMinimum) + 1
        : exclusiveMinimum;
    }
  }

  if ("exclusiveMaximum" in obj) {
    const { exclusiveMaximum } = obj;
    delete obj.exclusiveMaximum;

    if (typeof exclusiveMaximum === "number" && !("maximum" in obj)) {
      obj.maximum = isInteger
        ? Math.ceil(exclusiveMaximum) - 1
        : exclusiveMaximum;
    }
  }
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

    removeExclusiveBounds(newObj);

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
