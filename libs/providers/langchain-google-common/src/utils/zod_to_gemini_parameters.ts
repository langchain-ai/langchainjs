import {
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  type JsonSchema7Type,
  toJsonSchema,
} from "@langchain/core/utils/json_schema";
import {
  GeminiFunctionSchema,
  GeminiJsonSchema,
  GeminiJsonSchemaDirty,
} from "../types.js";

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
    // There are only two values set for the type, and one of them is "null".
    // Set the type to the other one and set nullable to true.
    const typeIndex = nullIndex === 0 ? 1 : 0;
    obj.type = obj.type[typeIndex];
    obj.nullable = true;
  } else if (len === 1 && nullIndex === 0) {
    // This is nullable only without a type, which doesn't
    // make sense for Gemini
    throw new Error("zod_to_gemini_parameters: Gemini cannot handle null type");
  } else if (len === 1) {
    // Although an array, it has only one value.
    // So set it to the string to match what Gemini expects.
    obj.type = obj?.type[0];
  } else {
    // Anything else could be a union type, so reject it.
    throw new Error(
      "zod_to_gemini_parameters: Gemini cannot handle union types"
    );
  }
  return obj;
}

export function removeAdditionalProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>
): GeminiJsonSchema {
  if (typeof obj === "object" && obj !== null) {
    const newObj = { ...obj };

    if ("additionalProperties" in newObj) {
      delete newObj.additionalProperties;
    }

    // Check for union types (anyOf, oneOf) which Gemini doesn't support
    if ("anyOf" in newObj || "oneOf" in newObj) {
      throw new Error(
        "zod_to_gemini_parameters: Gemini cannot handle union types (discriminatedUnion, anyOf, oneOf). " +
          "Consider using a flat object structure with optional fields instead."
      );
    }

    // Convert exclusiveMinimum (from .positive()) to minimum
    if ("exclusiveMinimum" in newObj && newObj.exclusiveMinimum === 0) {
      // Convert .positive() to .min(0.01)
      newObj.minimum = 0.01;
      delete newObj.exclusiveMinimum;
    } else if ("exclusiveMinimum" in newObj) {
      // Convert other exclusiveMinimum to minimum with a small increment
      newObj.minimum = newObj.exclusiveMinimum + 0.00001;
      delete newObj.exclusiveMinimum;
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

    return newObj as GeminiJsonSchema;
  }

  return obj as GeminiJsonSchema;
}

export function schemaToGeminiParameters<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(schema: InteropZodType<RunOutput> | JsonSchema7Type): GeminiFunctionSchema {
  // Gemini doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  // Zod sometimes also makes an array of type (because of .nullish()),
  // which needs cleaning up.
  const jsonSchema = removeAdditionalProperties(
    isInteropZodSchema(schema) ? toJsonSchema(schema) : schema
  );
  const { $schema, ...rest } = jsonSchema;

  return rest;
}

export function jsonSchemaToGeminiParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>
): GeminiFunctionSchema {
  // Gemini doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  const jsonSchema = removeAdditionalProperties(
    schema as GeminiJsonSchemaDirty
  );
  const { $schema, ...rest } = jsonSchema;

  return rest;
}
