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

    // Gemini's schema only supports `minimum`/`maximum`, not their exclusive
    // variants. Zod's .positive()/.negative()/.gt()/.lt() emit
    // exclusiveMinimum/exclusiveMaximum, and forwarding those yields a 400
    // ("Unknown name exclusiveMinimum"). Remap to the inclusive keywords,
    // mirroring @langchain/google-common's handling.
    if ("exclusiveMinimum" in newObj && newObj.exclusiveMinimum === 0) {
      newObj.minimum = 0.01;
      delete newObj.exclusiveMinimum;
    } else if ("exclusiveMinimum" in newObj) {
      newObj.minimum = newObj.exclusiveMinimum + 0.00001;
      delete newObj.exclusiveMinimum;
    }
    if ("exclusiveMaximum" in newObj && newObj.exclusiveMaximum === 0) {
      newObj.maximum = -0.01;
      delete newObj.exclusiveMaximum;
    } else if ("exclusiveMaximum" in newObj) {
      newObj.maximum = newObj.exclusiveMaximum - 0.00001;
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
