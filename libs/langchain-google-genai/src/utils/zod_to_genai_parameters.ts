/* eslint-disable @typescript-eslint/no-unused-vars */

import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  type FunctionDeclarationSchema as GenerativeAIFunctionDeclarationSchema,
  type SchemaType as FunctionDeclarationSchemaType,
} from "@google/generative-ai";

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

export function zodToGenerativeAIParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zodObj: z.ZodType<any>
): GenerativeAIFunctionDeclarationSchema {
  // GenerativeAI doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  const jsonSchema = removeAdditionalProperties(zodToJsonSchema(zodObj));
  const { $schema, ...rest } = jsonSchema;

  return rest as GenerativeAIFunctionDeclarationSchema;
}

export function jsonSchemaToGeminiParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>
): GenerativeAIFunctionDeclarationSchema {
  // Gemini doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonSchema = removeAdditionalProperties(
    schema as GenerativeAIJsonSchemaDirty
  );
  const { $schema, ...rest } = jsonSchema;

  return rest as GenerativeAIFunctionDeclarationSchema;
}
