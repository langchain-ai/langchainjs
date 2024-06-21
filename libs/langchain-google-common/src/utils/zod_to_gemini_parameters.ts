/* eslint-disable @typescript-eslint/no-unused-vars */

import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  GeminiFunctionSchema,
  GeminiJsonSchema,
  GeminiJsonSchemaDirty,
} from "../types.js";

function removeAdditionalProperties(
  schema: GeminiJsonSchemaDirty
): GeminiJsonSchema {
  const updatedSchema: GeminiJsonSchemaDirty = { ...schema };
  if (Object.hasOwn(updatedSchema, "additionalProperties")) {
    delete updatedSchema.additionalProperties;
  }
  if (updatedSchema.properties) {
    const keys = Object.keys(updatedSchema.properties);
    removeProperties(updatedSchema.properties, keys, 0);
  }
  if (Object.hasOwn(updatedSchema, "items") && updatedSchema.items) {
    updatedSchema.items = removeAdditionalProperties(updatedSchema.items);
  }

  return updatedSchema;
}

function removeProperties(
  properties: Record<string, GeminiJsonSchemaDirty>,
  keys: string[],
  index: number
): void {
  if (index >= keys.length) {
    return;
  }

  const key = keys[index];
  // eslint-disable-next-line no-param-reassign
  properties[key] = removeAdditionalProperties(properties[key]);
  removeProperties(properties, keys, index + 1);
}

export function zodToGeminiParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zodObj: z.ZodType<any>
): GeminiFunctionSchema {
  // Gemini doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // const jsonSchema = zodToJsonSchema(zodObj) as any;
  const jsonSchema = removeAdditionalProperties(
    zodToJsonSchema(zodObj) as GeminiJsonSchemaDirty
  );
  const { $schema, ...rest } = jsonSchema;

  return rest;
}
