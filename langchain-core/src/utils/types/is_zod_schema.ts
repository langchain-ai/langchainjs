import { type z } from "zod";

/**
 * Given either a Zod schema, or plain object, determine if the input is a Zod schema.
 *
 * @param {z.ZodType<RunOutput> | Record<string, any>} input
 * @returns {boolean} Whether or not the provided input is a Zod schema.
 */
export function isZodSchema<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: z.ZodType<RunOutput> | Record<string, any>
): input is z.ZodType<RunOutput> {
  // Check for a characteristic method of Zod schemas
  return typeof (input as z.ZodType<RunOutput>)?.parse === "function";
}
