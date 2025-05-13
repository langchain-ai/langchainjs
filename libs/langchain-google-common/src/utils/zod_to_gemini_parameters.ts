/* eslint-disable @typescript-eslint/no-unused-vars */

import type { z } from "zod";
import { isZodSchema } from "@langchain/core/utils/types";
import { type JsonSchema7Type, zodToJsonSchema } from "zod-to-json-schema";
import {
  GeminiFunctionSchema,
  GeminiJsonSchema,
  GeminiJsonSchemaDirty,
} from "../types.js";

export function removeAdditionalProperties(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>
): GeminiJsonSchema {
  if (typeof obj === "object" && obj !== null) {
    const newObj = { ...obj };

    if ("additionalProperties" in newObj) {
      delete newObj.additionalProperties;
    }

    if (Array.isArray(obj.type)) {
      // Gemini requires type be a string, so we use the first defined one
      newObj.type = obj?.type[0];

      // If type contains "null", which isn't allowed, set "nullable" to true
      if (obj.type.includes("null")) {
        newObj.nullable = true;
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

    return newObj as GeminiJsonSchema;
  }

  return obj as GeminiJsonSchema;
}

export function schemaToGeminiParameters<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  schema:
    | z.ZodType<RunOutput>
    | z.ZodEffects<z.ZodType<RunOutput>>
    | JsonSchema7Type
): GeminiFunctionSchema {
  // Gemini doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  // Zod sometimes also makes an array of type (because of .nullish()),
  // which needs cleaning up.
  const jsonSchema = removeAdditionalProperties(
    isZodSchema(schema) ? zodToJsonSchema(schema) : schema
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonSchema = removeAdditionalProperties(
    schema as GeminiJsonSchemaDirty
  );
  const { $schema, ...rest } = jsonSchema;

  return rest;
}
