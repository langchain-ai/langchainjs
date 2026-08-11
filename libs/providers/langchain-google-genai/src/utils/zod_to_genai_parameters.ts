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
  anyOf?: GenerativeAIJsonSchema[];
  nullable?: boolean;
  properties?: Record<string, GenerativeAIJsonSchema>;
  type?: FunctionDeclarationSchemaType;
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

    if (Array.isArray(newObj.type)) {
      const types = newObj.type;
      if (
        types.every((type: unknown): type is string => typeof type === "string")
      ) {
        const hasNull = types.includes("null");
        const nonNullTypes = [
          ...new Set(types.filter((type: string) => type !== "null")),
        ];

        if (nonNullTypes.length === 1) {
          newObj.type = nonNullTypes[0];
          if (hasNull) {
            newObj.nullable = true;
          }
        } else if (nonNullTypes.length > 1) {
          delete newObj.type;
          newObj.anyOf = nonNullTypes.map((type) => ({ type }));
          if (hasNull) {
            newObj.nullable = true;
          }
        } else if (hasNull) {
          if (types.length === 1) {
            newObj.type = "null";
          } else {
            delete newObj.type;
            newObj.nullable = true;
          }
        }
      }
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
