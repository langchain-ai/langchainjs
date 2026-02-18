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

export function adjustObjectType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  if (!Array.isArray(obj.type)) {
    return obj;
  }

  const len = obj.type.length;
  const nullIndex = obj.type.indexOf("null");
  if (len === 2 && nullIndex >= 0) {
    const typeIndex = nullIndex === 0 ? 1 : 0;
    obj.type = obj.type[typeIndex];
    obj.nullable = true;
  } else if (len === 1 && nullIndex === 0) {
    throw new Error("zod_to_genai_parameters: Gemini cannot handle null type");
  } else if (len === 1) {
    obj.type = obj.type[0];
  } else {
    throw new Error(
      "zod_to_genai_parameters: Gemini cannot handle union types"
    );
  }
  return obj;
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

    if ("anyOf" in newObj || "oneOf" in newObj) {
      const unionTypes = newObj.anyOf || newObj.oneOf;
      if (Array.isArray(unionTypes) && unionTypes.length === 2) {
        const nullIndex = unionTypes.findIndex(
          (t) => typeof t === "object" && t !== null && t.type === "null"
        );
        if (nullIndex >= 0) {
          const nonNullType = unionTypes[nullIndex === 0 ? 1 : 0];
          delete newObj.anyOf;
          delete newObj.oneOf;
          if (typeof nonNullType === "object" && nonNullType !== null) {
            for (const key in nonNullType) {
              if (key in nonNullType) {
                newObj[key] = nonNullType[key];
              }
            }
            newObj.nullable = true;
          } else {
            throw new Error(
              "zod_to_genai_parameters: Gemini cannot handle union types (discriminatedUnion, anyOf, oneOf). " +
                "Consider using a flat object structure with optional fields instead."
            );
          }
        } else {
          throw new Error(
            "zod_to_genai_parameters: Gemini cannot handle union types (discriminatedUnion, anyOf, oneOf). " +
              "Consider using a flat object structure with optional fields instead."
          );
        }
      } else {
        throw new Error(
          "zod_to_genai_parameters: Gemini cannot handle union types (discriminatedUnion, anyOf, oneOf). " +
            "Consider using a flat object structure with optional fields instead."
        );
      }
    }

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>,
>(
  schema: InteropZodType<RunOutput> | JsonSchema7Type
): GenerativeAIFunctionDeclarationSchema {
  // GenerativeAI doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  const jsonSchema = removeAdditionalProperties(
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
  const jsonSchema = removeAdditionalProperties(
    schema as GenerativeAIJsonSchemaDirty
  );
  const { $schema, ...rest } = jsonSchema;

  return rest as GenerativeAIFunctionDeclarationSchema;
}
