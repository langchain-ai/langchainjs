/* eslint-disable @typescript-eslint/no-unused-vars */

import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  type FunctionDeclarationSchema as GenerativeAIFunctionDeclarationSchema,
  FunctionDeclarationSchemaType,
} from "@google/generative-ai";

export interface GenerativeAIJsonSchema extends Record<string, unknown> {
  properties?: Record<string, GenerativeAIJsonSchema>;
  type: FunctionDeclarationSchemaType;
}

export interface GenerativeAIJsonSchemaDirty extends GenerativeAIJsonSchema {
  properties?: Record<string, GenerativeAIJsonSchemaDirty>;
  additionalProperties?: boolean;
}

function removeAdditionalProperties(
  schema: GenerativeAIJsonSchemaDirty
): GenerativeAIJsonSchema {
  const updatedSchema: GenerativeAIJsonSchemaDirty = { ...schema };
  if (Object.hasOwn(updatedSchema, "additionalProperties")) {
    delete updatedSchema.additionalProperties;
  }
  if (updatedSchema.properties) {
    const keys = Object.keys(updatedSchema.properties);
    removeProperties(updatedSchema.properties, keys, 0);
  }

  return updatedSchema;
}

function removeProperties(
  properties: GenerativeAIJsonSchemaDirty["properties"],
  keys: string[],
  index: number
): void {
  if (index >= keys.length || !properties) {
    return;
  }

  const key = keys[index];
  // eslint-disable-next-line no-param-reassign
  properties[key] = removeAdditionalProperties(properties[key]);
  removeProperties(properties, keys, index + 1);
}

export function zodToGenerativeAIParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zodObj: z.ZodType<any>
): GenerativeAIFunctionDeclarationSchema {
  // GenerativeAI doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  const jsonSchema = removeAdditionalProperties(
    zodToJsonSchema(zodObj) as GenerativeAIJsonSchemaDirty
  );
  const { $schema, ...rest } = jsonSchema;

  return rest as GenerativeAIFunctionDeclarationSchema;
}
