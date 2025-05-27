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
  if (typeof schema !== "object" || schema === null) {
    return false;
  }

  const obj = schema as Record<string, unknown>;
  if (!("_zod" in obj)) {
    return false;
  }

  const zod = obj._zod;
  return (
    typeof zod === "object" &&
    zod !== null &&
    "def" in (zod as Record<string, unknown>)
  );
}

export function isZodSchemaV3(
  schema: unknown
): schema is z3.ZodType<unknown, z3.ZodTypeDef, unknown> {
  if (typeof schema !== "object" || schema === null) {
    return false;
  }

  const obj = schema as Record<string, unknown>;
  if (!("_def" in obj) || "_zod" in obj) {
    return false;
  }

  const def = obj._def;
  return (
    typeof def === "object" &&
    def !== null &&
    "typeName" in (def as Record<string, unknown>)
  );
}

/**
 * Given either a Zod schema, or plain object, determine if the input is a Zod schema.
 *
 * @param {unknown} input
 * @returns {boolean} Whether or not the provided input is a Zod schema.
 */
export function isZodSchema(input: unknown): input is InteropZodType {
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
 * ZodRecord schemas are considered shapeless since they define dynamic
 * key-value mappings without fixed keys.
 *
 * @param schema The Zod schema to check.
 * @returns {boolean} True if the schema is shapeless, false otherwise.
 */
export function isShapelessZodSchema(schema: unknown): boolean {
  if (!isZodSchema(schema)) {
    return false;
  }

  // Check for v3 schemas
  if (isZodSchemaV3(schema)) {
    const def = schema._def as { typeName?: string };

    // ZodObject is only shaped if it has actual shape keys
    if (def.typeName === "ZodObject") {
      const obj = schema as { shape?: Record<string, unknown> };
      return !obj.shape || Object.keys(obj.shape).length === 0;
    }

    // ZodRecord is shapeless (dynamic key-value mapping)
    if (def.typeName === "ZodRecord") {
      return true;
    }
  }

  // Check for v4 schemas
  if (isZodSchemaV4(schema)) {
    const def = schema._zod.def;

    // Object type is only shaped if it has actual shape keys
    if (def.type === "object") {
      const obj = schema as { shape?: Record<string, unknown> };
      return !obj.shape || Object.keys(obj.shape).length === 0;
    }

    // Record type is shapeless (dynamic key-value mapping)
    if (def.type === "record") {
      return true;
    }
  }

  // For other schemas, check if they have a `shape` property
  // If they don't have shape, they're likely shapeless
  if (typeof schema === "object" && schema !== null && !("shape" in schema)) {
    return true;
  }

  return false;
}

/**
 * Determines if the provided Zod schema should be treated as a simple string schema
 * that maps to DynamicTool. This aligns with the type-level constraint of
 * InteropZodType<string, unknown> which only matches schemas that output strings.
 *
 * This function checks if the schema's output type is a string, including:
 * - Basic string schemas (z.string())
 * - Transformed schemas that output strings (z.object().transform(() => string))
 * - Other schemas that ultimately resolve to string outputs
 *
 * @param schema The Zod schema to check.
 * @returns {boolean} True if the schema should be treated as a simple string schema, false otherwise.
 */
export function isSimpleStringZodSchema(
  schema: unknown
): schema is InteropZodType<string, unknown> {
  if (!isZodSchema(schema)) {
    return false;
  }

  // For v3 schemas
  if (isZodSchemaV3(schema)) {
    const def = schema._def as {
      typeName?: string;
      innerType?: unknown;
      type?: unknown;
    };

    // Handle ZodRecord - records are not simple string schemas even though they're shapeless
    if (def.typeName === "ZodRecord") {
      return false;
    }

    // Handle ZodObject - objects are not simple string schemas
    if (def.typeName === "ZodObject") {
      return false;
    }

    // Handle ZodEffects (transforms, refinements, etc.)
    if (def.typeName === "ZodEffects") {
      // For transforms, we need to check if the output would be a string
      // This is complex to determine statically, so we'll use a heuristic:
      // If it's a shapeless schema (no object structure), it's likely a string transform
      return isShapelessZodSchema(schema);
    }

    // Handle basic ZodString
    if (def.typeName === "ZodString") {
      return true;
    }

    // Handle ZodBranded - branded strings are still strings
    if (def.typeName === "ZodBranded") {
      return isSimpleStringZodSchema(def.type);
    }

    // Handle ZodCatch - catch operations preserve the underlying type
    if (def.typeName === "ZodCatch") {
      return isSimpleStringZodSchema(def.innerType);
    }

    // Handle ZodDefault - defaults eliminate undefined/null, so if the inner type
    // would be a simple string schema, the default makes it a simple string schema too
    if (def.typeName === "ZodDefault") {
      return isSimpleStringZodSchema(def.innerType);
    }

    return false;
  }

  // For v4 schemas
  if (isZodSchemaV4(schema)) {
    const def = schema._zod.def;

    // Handle record type - records are not simple string schemas even though they're shapeless
    if (def.type === "record") {
      return false;
    }

    // Handle object type - objects are not simple string schemas
    if (def.type === "object") {
      return false;
    }

    // Handle pipe operations (v4 transforms)
    if (def.type === "pipe") {
      // Similar to v3, we'll use the same heuristic to determine if the output would be a string.
      return isShapelessZodSchema(schema);
    }

    // Handle basic string
    if (def.type === "string") {
      return true;
    }

    // Handle defaults - they eliminate undefined/null from the output type
    if (def.type === "default") {
      return isSimpleStringZodSchema(
        (def as { innerType?: unknown }).innerType
      );
    }

    return false;
  }

  return false;
}

export function getZodSafeParseIssues<T>(
  result: InteropZodSafeParseResult<T>
): InteropZodIssue[] {
  return result.error?.issues ?? [];
}
