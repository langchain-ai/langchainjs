import * as z3 from "zod/v3";
import * as z4 from "zod/v4";
import * as zc from "zod/v4/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InteropZodType<Output = any, Input = Output> =
  | z3.ZodType<Output, z3.ZodTypeDef, Input>
  | z4.ZodType<Output, Input>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InteropZodObject = z3.ZodObject<any, any, any, any> | z4.ZodObject;

export type InteropZodString = z3.ZodString | z4.ZodString;

export type InteropZodSafeParseResult<Output = any, Input = Output> =
  | z3.SafeParseReturnType<Input, Output>
  | z4.ZodSafeParseResult<Output>;

export type InteropZodIssue = z3.ZodIssue | zc.$ZodIssue;

export type InferInteropZodInput<T extends InteropZodType<unknown, unknown>> =
  T extends z3.ZodType<infer Input, z3.ZodTypeDef, unknown>
    ? Input
    : T extends z4.ZodType<infer Input, unknown>
    ? Input
    : never;

export type InferInteropZodOutput<T extends InteropZodType<unknown, unknown>> =
  T extends z3.ZodType<unknown, z3.ZodTypeDef, infer Output>
    ? Output
    : T extends z4.ZodType<unknown, infer Output>
    ? Output
    : never;

export function isZodSchemaV4(
  schema: unknown
): schema is z4.ZodType<unknown, unknown> {
  return typeof schema === "object" && schema !== null && "_zod" in schema;
}

export function isZodSchemaV3(
  schema: unknown
): schema is z3.ZodType<unknown, z3.ZodTypeDef, unknown> {
  return typeof schema === "object" && schema !== null && "_def" in schema;
}

/**
 * Given either a Zod schema, or plain object, determine if the input is a Zod schema.
 *
 * @param {InteropZodType<RunOutput> | Record<string, unknown>} input
 * @returns {boolean} Whether or not the provided input is a Zod schema.
 */
export function isZodSchema<
  RunOutput extends Record<string, unknown> = Record<string, unknown>
>(
  input: InteropZodType<RunOutput> | Record<string, unknown>
): input is InteropZodType<RunOutput> {
  if (!input) {
    return false;
  }
  if (typeof input !== "object") {
    return false;
  }
  if (Array.isArray(input)) {
    return false;
  }
  if (isZodSchemaV4(input) || isZodSchemaV3(input)) {
    return true;
  }
  return false;
}

export function getZodSafeParseIssues<T>(
  result: InteropZodSafeParseResult<T>
): InteropZodIssue[] {
  return result.error?.issues ?? [];
}
