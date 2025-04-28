import { z } from "zod";

/**
 * Given either a Zod schema, or plain object, determine if the input is a Zod schema.
 *
 * @param {z.ZodType<RunOutput> | Record<string, unknown>} input
 * @returns {boolean} Whether or not the provided input is a Zod schema.
 */
export function isZodSchema<
  RunOutput extends Record<string, unknown> = Record<string, unknown>
>(
  input: z.ZodType<RunOutput> | Record<string, unknown>
): input is z.ZodType<RunOutput> {
  if (!input) {
    return false;
  }

  if (typeof input !== "object") {
    return false;
  }

  if (Array.isArray(input)) {
    return false;
  }

  const asZodSchema = input as z.ZodType<RunOutput>;

  // relies on an internal property of Zod schemas, so this may break in the future, hence the
  // additional fallback checks below
  if (asZodSchema._def) {
    return true;
  }

  const zodFirstPartyTypeKinds = Object.values(
    z.ZodFirstPartyTypeKind
  ) as string[];

  if (
    zodFirstPartyTypeKinds.includes(
      asZodSchema.constructor?.name ?? "NOT_INCLUDED"
    )
  ) {
    return true;
  }

  // if all else fails, assume based on the presence of parse, parseAsync, safeParse, and
  // safeParseAsync, as these are characteristic of Zod schemas
  return (
    typeof asZodSchema.parse === "function" &&
    typeof asZodSchema.parseAsync === "function" &&
    typeof asZodSchema.safeParse === "function" &&
    typeof asZodSchema.safeParseAsync === "function"
  );
}
