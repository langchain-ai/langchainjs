/* eslint-disable @typescript-eslint/no-unused-vars */

import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
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

export function zodToGeminiParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zodObj: z.ZodType<any>
): GeminiFunctionSchema {
  // Gemini doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonSchema = removeAdditionalProperties(zodToJsonSchema(zodObj));
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
