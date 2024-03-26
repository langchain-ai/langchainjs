import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { GeminiFunctionSchema } from "../types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodToGeminiParameters(zodObj: z.ZodType<any>): GeminiFunctionSchema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonSchema = zodToJsonSchema(zodObj) as any;
  const { $schema, additionalProperties, ...rest } = jsonSchema;

  return rest;
}