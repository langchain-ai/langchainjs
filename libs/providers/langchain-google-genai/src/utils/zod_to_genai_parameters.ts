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

export interface GenerativeAIJsonSchema extends Record<string, unknown> {
  properties?: Record<string, GenerativeAIJsonSchema>;
  type: FunctionDeclarationSchemaType;
}

export interface GenerativeAIJsonSchemaDirty extends GenerativeAIJsonSchema {
  properties?: Record<string, GenerativeAIJsonSchemaDirty>;
  additionalProperties?: boolean;
}

export function removeAdditionalProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export function processEnumFieldsForGemini(
  schema: Record<string, unknown>
): GenerativeAIJsonSchema {
  const processed = removeAdditionalProperties(schema);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function removeTypeFromEnums(obj: any): any {
    if (typeof obj !== "object" || obj === null) return obj;

    const result = { ...obj };

    // Check if this object has both enum and type fields
    if ("enum" in result && "type" in result && result.type === "string") {
      delete result.type;
    }

    // Recursively process nested objects
    if (result.properties && typeof result.properties === "object") {
      result.properties = Object.fromEntries(
        Object.entries(result.properties).map(([key, value]) => [
          key,
          removeTypeFromEnums(value),
        ])
      );
    }

    // Process items in arrays
    if (result.items) {
      result.items = removeTypeFromEnums(result.items);
    }

    // Process items in arrays (oneOf, anyOf, allOf)
    if (result.oneOf && Array.isArray(result.oneOf)) {
      result.oneOf = result.oneOf.map(removeTypeFromEnums);
    }
    if (result.anyOf && Array.isArray(result.anyOf)) {
      result.anyOf = result.anyOf.map(removeTypeFromEnums);
    }
    if (result.allOf && Array.isArray(result.allOf)) {
      result.allOf = result.allOf.map(removeTypeFromEnums);
    }

    return result;
  }

  return removeTypeFromEnums(processed);
}

export function schemaToGenerativeAIParameters<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  schema: InteropZodType<RunOutput> | JsonSchema7Type
): GenerativeAIFunctionDeclarationSchema {
  // GenerativeAI doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  // Also need to handle enums specially for Gemini
  const jsonSchema = processEnumFieldsForGemini(
    isInteropZodSchema(schema) ? toJsonSchema(schema) : schema
  );
  const { $schema, ...rest } = jsonSchema;

  return rest as GenerativeAIFunctionDeclarationSchema;
}

export function jsonSchemaToGeminiParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>
): GenerativeAIFunctionDeclarationSchema {
  // Gemini doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  // Also need to handle enums specially for Gemini
  const jsonSchema = processEnumFieldsForGemini(schema);
  const { $schema, ...rest } = jsonSchema;

  return rest as GenerativeAIFunctionDeclarationSchema;
}
