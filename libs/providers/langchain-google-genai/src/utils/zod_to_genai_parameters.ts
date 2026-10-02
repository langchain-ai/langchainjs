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

    // Gemini's responseSchema does not support exclusiveMinimum /
    // exclusiveMaximum. For integer schemas we can losslessly remap to
    // minimum / maximum; for other types we drop the keyword so the
    // request is not rejected with a 400.
    if ("exclusiveMinimum" in newObj) {
      const exclusiveMin = newObj.exclusiveMinimum;
      if (newObj.type === "integer" && typeof exclusiveMin === "number") {
        const remapped = exclusiveMin + 1;
        if (typeof newObj.minimum !== "number" || newObj.minimum < remapped) {
          newObj.minimum = remapped;
        }
      }
      delete newObj.exclusiveMinimum;
    }
    if ("exclusiveMaximum" in newObj) {
      const exclusiveMax = newObj.exclusiveMaximum;
      if (newObj.type === "integer" && typeof exclusiveMax === "number") {
        const remapped = exclusiveMax - 1;
        if (typeof newObj.maximum !== "number" || newObj.maximum > remapped) {
          newObj.maximum = remapped;
        }
      }
      delete newObj.exclusiveMaximum;
    }

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
