/* eslint-disable @typescript-eslint/no-unused-vars */

import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { GeminiFunctionSchema } from "../types.js";

export function zodToGeminiParameters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zodObj: z.ZodType<any>
): GeminiFunctionSchema {
  // Gemini doesn't accept either the $schema or additionalProperties
  // attributes, so we need to explicitly remove them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonSchema = zodToJsonSchema(zodObj) as any;
  const { $schema, additionalProperties, ...rest } = jsonSchema;

  return rest;
}
