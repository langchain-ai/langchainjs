import * as z3 from "zod/v3";
import * as z4 from "zod/v4/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InteropZodType<Output = any, Input = Output> =
  | z3.ZodType<Output, z3.ZodTypeDef, Input>
  | z4.$ZodType<Output, Input>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InteropZodObject = z3.ZodObject<any, any, any, any> | z4.$ZodObject;

export type InteropZodString = z3.ZodString | z4.$ZodString;

export type InteropZodIssue = z3.ZodIssue | z4.$ZodIssue;

// Simplified type inference to avoid circular dependencies
export type InferInteropZodInput<T> = T extends z3.ZodType<
  unknown,
  z3.ZodTypeDef,
  infer Input
>
  ? Input
  : T extends z4.$ZodType<unknown, infer Input>
  ? Input
  : T extends { _zod: { input: infer Input } }
  ? Input
  : never;

export type InferInteropZodOutput<T> = T extends z3.ZodType<
  infer Output,
  z3.ZodTypeDef,
  unknown
>
  ? Output
  : T extends z4.$ZodType<infer Output, unknown>
  ? Output
  : T extends { _zod: { output: infer Output } }
  ? Output
  : never;

export function isZodSchemaV4(
  schema: unknown
): schema is z4.$ZodType<unknown, unknown> {
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

type InteropZodSafeParseResult<T> = z3.SafeParseReturnType<T, T>;

export function safeParseInteropZodSchema<T>(
  schema: InteropZodType<T>,
  input: unknown
): InteropZodSafeParseResult<T> {
  if (isZodSchemaV4(schema)) {
    try {
      const result = z4.parse(schema, input);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error as z3.ZodError<T>,
      };
    }
  }
  if (isZodSchemaV3(schema)) {
    return schema.safeParse(input);
  }
  throw new Error("Schema must be an instance of z3.ZodType or z4.$ZodType");
}

/**
 * Determines if the provided Zod schema is "shapeless".
 * A shapeless schema is one that does not define any object shape,
 * such as ZodString, ZodNumber, ZodBoolean, ZodAny, etc.
 * For ZodObject, it must have no shape keys to be considered shapeless.
 *
 * @param schema The Zod schema to check.
 * @returns {boolean} True if the schema is shapeless, false otherwise.
 */
export function isShapelessZodSchema(schema: unknown): boolean {
  if (!isZodSchema(schema as Record<string, unknown>)) {
    return false;
  }
  // `shape` exists as a property in v3 and v4
  if (typeof schema === "object" && schema !== null && "shape" in schema) {
    return true;
  }
  return false;
}

export function getZodSafeParseIssues<T>(
  result: InteropZodSafeParseResult<T>
): InteropZodIssue[] {
  return result.error?.issues ?? [];
}
