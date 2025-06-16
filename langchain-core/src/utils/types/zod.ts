import type * as z3 from "zod/v3";
import type * as z4 from "zod/v4/core";
import {
  parse,
  parseAsync,
  globalRegistry,
  util,
  clone,
  _unknown,
  $ZodUnknown,
  $ZodOptional,
} from "zod/v4/core";

export type ZodStringV3 = z3.ZodString;

export type ZodStringV4 = z4.$ZodType<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodObjectV3 = z3.ZodObject<any, any, any, any>;

export type ZodObjectV4 = z4.$ZodObject;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InteropZodType<Output = any, Input = Output> =
  | z3.ZodType<Output, z3.ZodTypeDef, Input>
  | z4.$ZodType<Output, Input>;

export type InteropZodObject = ZodObjectV3 | ZodObjectV4;

export type InteropZodObjectShape<
  T extends InteropZodObject = InteropZodObject
> = T extends z3.ZodObject<infer Shape>
  ? { [K in keyof Shape]: Shape[K] }
  : T extends z4.$ZodObject<infer Shape>
  ? { [K in keyof Shape]: Shape[K] }
  : never;

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
    def != null &&
    "typeName" in (def as Record<string, unknown>)
  );
}

/** Backward compatible isZodSchema for Zod 3 */
export function isZodSchema<
  RunOutput extends Record<string, unknown> = Record<string, unknown>
>(
  schema: z3.ZodType<RunOutput> | Record<string, unknown>
): schema is z3.ZodType<RunOutput> {
  if (isZodSchemaV4(schema)) {
    console.warn(
      "[WARNING] Attempting to use Zod 4 schema in a context where Zod 3 schema is expected. This may cause unexpected behavior."
    );
  }
  return isZodSchemaV3(schema);
}

/**
 * Given either a Zod schema, or plain object, determine if the input is a Zod schema.
 *
 * @param {unknown} input
 * @returns {boolean} Whether or not the provided input is a Zod schema.
 */
export function isInteropZodSchema(input: unknown): input is InteropZodType {
  if (!input) {
    return false;
  }
  if (typeof input !== "object") {
    return false;
  }
  if (Array.isArray(input)) {
    return false;
  }
  if (
    isZodSchemaV4(input) ||
    isZodSchemaV3(input as z3.ZodType<Record<string, unknown>>)
  ) {
    return true;
  }
  return false;
}

type InteropZodSafeParseResult<T> = z3.SafeParseReturnType<T, T>;

/**
 * Asynchronously parses the input using the provided Zod schema (v3 or v4) and returns a safe parse result.
 * This function handles both Zod v3 and v4 schemas, returning a result object indicating success or failure.
 *
 * @template T - The expected output type of the schema.
 * @param {InteropZodType<T>} schema - The Zod schema (v3 or v4) to use for parsing.
 * @param {unknown} input - The input value to parse.
 * @returns {Promise<InteropZodSafeParseResult<T>>} A promise that resolves to a safe parse result object.
 * @throws {Error} If the schema is not a recognized Zod v3 or v4 schema.
 */
export async function interopSafeParseAsync<T>(
  schema: InteropZodType<T>,
  input: unknown
): Promise<InteropZodSafeParseResult<T>> {
  if (isZodSchemaV4(schema)) {
    try {
      const data = await parseAsync(schema, input);
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error as z3.ZodError<T>,
      };
    }
  }
  if (isZodSchemaV3(schema as z3.ZodType<Record<string, unknown>>)) {
    return schema.safeParse(input);
  }
  throw new Error("Schema must be an instance of z3.ZodType or z4.$ZodType");
}

/**
 * Asynchronously parses the input using the provided Zod schema (v3 or v4) and returns the parsed value.
 * Throws an error if parsing fails or if the schema is not a recognized Zod v3 or v4 schema.
 *
 * @template T - The expected output type of the schema.
 * @param {InteropZodType<T>} schema - The Zod schema (v3 or v4) to use for parsing.
 * @param {unknown} input - The input value to parse.
 * @returns {Promise<T>} A promise that resolves to the parsed value.
 * @throws {Error} If parsing fails or the schema is not a recognized Zod v3 or v4 schema.
 */
export async function interopParseAsync<T>(
  schema: InteropZodType<T>,
  input: unknown
): Promise<T> {
  if (isZodSchemaV4(schema)) {
    return parse(schema, input);
  }
  if (isZodSchemaV3(schema as z3.ZodType<Record<string, unknown>>)) {
    return schema.parse(input);
  }
  throw new Error("Schema must be an instance of z3.ZodType or z4.$ZodType");
}

/**
 * Safely parses the input using the provided Zod schema (v3 or v4) and returns a result object
 * indicating success or failure. This function is compatible with both Zod v3 and v4 schemas.
 *
 * @template T - The expected output type of the schema.
 * @param {InteropZodType<T>} schema - The Zod schema (v3 or v4) to use for parsing.
 * @param {unknown} input - The input value to parse.
 * @returns {InteropZodSafeParseResult<T>} An object with either the parsed data (on success)
 *   or the error (on failure).
 * @throws {Error} If the schema is not a recognized Zod v3 or v4 schema.
 */
export function interopSafeParse<T>(
  schema: InteropZodType<T>,
  input: unknown
): InteropZodSafeParseResult<T> {
  if (isZodSchemaV4(schema)) {
    try {
      const data = parse(schema, input);
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error as z3.ZodError<T>,
      };
    }
  }
  if (isZodSchemaV3(schema as z3.ZodType<Record<string, unknown>>)) {
    return schema.safeParse(input);
  }
  throw new Error("Schema must be an instance of z3.ZodType or z4.$ZodType");
}

/**
 * Parses the input using the provided Zod schema (v3 or v4) and returns the parsed value.
 * Throws an error if parsing fails or if the schema is not a recognized Zod v3 or v4 schema.
 *
 * @template T - The expected output type of the schema.
 * @param {InteropZodType<T>} schema - The Zod schema (v3 or v4) to use for parsing.
 * @param {unknown} input - The input value to parse.
 * @returns {T} The parsed value.
 * @throws {Error} If parsing fails or the schema is not a recognized Zod v3 or v4 schema.
 */
export function interopParse<T>(schema: InteropZodType<T>, input: unknown): T {
  if (isZodSchemaV4(schema)) {
    return parse(schema, input);
  }
  if (isZodSchemaV3(schema as z3.ZodType<Record<string, unknown>>)) {
    return schema.parse(input);
  }
  throw new Error("Schema must be an instance of z3.ZodType or z4.$ZodType");
}

/**
 * Retrieves the description from a schema definition (v3, v4, or plain object), if available.
 *
 * @param {unknown} schema - The schema to extract the description from.
 * @returns {string | undefined} The description of the schema, or undefined if not present.
 */
export function getSchemaDescription(
  schema: InteropZodType<unknown> | Record<string, unknown>
): string | undefined {
  if (isZodSchemaV4(schema)) {
    return globalRegistry.get(schema)?.description;
  }
  if (isZodSchemaV3(schema as z3.ZodType<Record<string, unknown>>)) {
    return schema.description as string | undefined;
  }
  if ("description" in schema && typeof schema.description === "string") {
    return schema.description;
  }
  return undefined;
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
  if (!isInteropZodSchema(schema)) {
    return false;
  }

  // Check for v3 schemas
  if (isZodSchemaV3(schema as z3.ZodType<Record<string, unknown>>)) {
    // @ts-expect-error - zod v3 types are not compatible with zod v4 types
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
 * InteropZodType<string | undefined> which only matches basic string schemas.
 * If the provided schema is just z.string(), we can make the determination that
 * the tool is just a generic string tool that doesn't require any input validation.
 *
 * This function only returns true for basic ZodString schemas, including:
 * - Basic string schemas (z.string())
 * - String schemas with validations (z.string().min(1), z.string().email(), etc.)
 *
 * This function returns false for everything else, including:
 * - String schemas with defaults (z.string().default("value"))
 * - Branded string schemas (z.string().brand<"UserId">())
 * - String schemas with catch operations (z.string().catch("default"))
 * - Optional/nullable string schemas (z.string().optional())
 * - Transformed schemas (z.string().transform() or z.object().transform())
 * - Object or record schemas, even if they're empty
 * - Any other schema type
 *
 * @param schema The Zod schema to check.
 * @returns {boolean} True if the schema is a basic ZodString, false otherwise.
 */
export function isSimpleStringZodSchema(
  schema: unknown
): schema is InteropZodType<string | undefined> {
  if (!isInteropZodSchema(schema)) {
    return false;
  }

  // For v3 schemas
  if (isZodSchemaV3(schema as z3.ZodType<Record<string, unknown>>)) {
    // @ts-expect-error - zod v3 types are not compatible with zod v4 types
    const def = schema._def as { typeName?: string };

    // Only accept basic ZodString
    return def.typeName === "ZodString";
  }

  // For v4 schemas
  if (isZodSchemaV4(schema)) {
    const def = schema._zod.def;

    // Only accept basic string type
    return def.type === "string";
  }

  return false;
}

/**
 * Determines if the provided value is an InteropZodObject (Zod v3 or v4 object schema).
 *
 * @param obj The value to check.
 * @returns {boolean} True if the value is a Zod v3 or v4 object schema, false otherwise.
 */
export function isInteropZodObject(obj: unknown): obj is InteropZodObject {
  if (isZodSchemaV3(obj)) {
    // Zod v3 object schemas have _def.typeName === "ZodObject"
    if (
      typeof obj === "object" &&
      obj !== null &&
      "_def" in obj &&
      typeof obj._def === "object" &&
      obj._def !== null &&
      "typeName" in obj._def &&
      obj._def.typeName === "ZodObject"
    ) {
      return true;
    }
  }
  if (isZodSchemaV4(obj)) {
    // Zod v4 object schemas have _zod.def.type === "object"
    if (
      typeof obj === "object" &&
      obj !== null &&
      "_zod" in obj &&
      typeof obj._zod === "object" &&
      obj._zod !== null &&
      "def" in obj._zod &&
      typeof obj._zod.def === "object" &&
      obj._zod.def !== null &&
      "type" in obj._zod.def &&
      obj._zod.def.type === "object"
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Retrieves the shape (fields) of a Zod object schema, supporting both Zod v3 and v4.
 *
 * @template T - The type of the Zod object schema.
 * @param {T} schema - The Zod object schema instance (either v3 or v4).
 * @returns {InteropZodObjectShape<T>} The shape of the object schema.
 * @throws {Error} If the schema is not a Zod v3 or v4 object.
 */
export function getInteropZodObjectShape<T extends InteropZodObject>(
  schema: T
): InteropZodObjectShape<T> {
  if (isZodSchemaV3(schema)) {
    return schema.shape;
  }
  if (isZodSchemaV4(schema)) {
    return schema._zod.def.shape as InteropZodObjectShape<T>;
  }
  throw new Error(
    "Schema must be an instance of z3.ZodObject or z4.$ZodObject"
  );
}

/**
 * Extends a Zod object schema with additional fields, supporting both Zod v3 and v4.
 *
 * @template T - The type of the Zod object schema.
 * @param {T} schema - The Zod object schema instance (either v3 or v4).
 * @param {InteropZodObjectShape} extension - The fields to add to the schema.
 * @returns {InteropZodObject} The extended Zod object schema.
 * @throws {Error} If the schema is not a Zod v3 or v4 object.
 */
export function extendInteropZodObject<T extends InteropZodObject>(
  schema: T,
  extension: InteropZodObjectShape
): InteropZodObject {
  if (isZodSchemaV3(schema)) {
    return schema.extend(extension as z3.ZodRawShape);
  }
  if (isZodSchemaV4(schema)) {
    return util.extend(schema, extension);
  }
  throw new Error(
    "Schema must be an instance of z3.ZodObject or z4.$ZodObject"
  );
}

/**
 * Returns a partial version of a Zod object schema, making all fields optional.
 * Supports both Zod v3 and v4.
 *
 * @template T - The type of the Zod object schema.
 * @param {T} schema - The Zod object schema instance (either v3 or v4).
 * @returns {InteropZodObject} The partial Zod object schema.
 * @throws {Error} If the schema is not a Zod v3 or v4 object.
 */
export function interopZodObjectPartial<T extends InteropZodObject>(
  schema: T
): InteropZodObject {
  if (isZodSchemaV3(schema)) {
    // z3: .partial() exists and works as expected
    return schema.partial();
  }
  if (isZodSchemaV4(schema)) {
    // z4: util.partial exists and works as expected
    return util.partial($ZodOptional, schema, undefined);
  }
  throw new Error(
    "Schema must be an instance of z3.ZodObject or z4.$ZodObject"
  );
}

export function interopZodObjectPassthrough<T extends InteropZodObject>(
  schema: T
): InteropZodObject {
  if (isInteropZodObject(schema)) {
    if (isZodSchemaV3(schema)) {
      return schema.passthrough();
    }
    if (isZodSchemaV4(schema)) {
      // Type reassign since ZodObjectV4 assumes that generics should be washed
      const objectSchema: z4.$ZodObject<z4.$ZodShape> = schema;
      return clone(objectSchema, {
        ...objectSchema._zod.def,
        catchall: _unknown($ZodUnknown),
      });
    }
  }
  throw new Error(
    "Schema must be an instance of z3.ZodObject or z4.$ZodObject"
  );
}

/**
 * Returns a getter function for the default value of a Zod schema, if one is defined.
 * Supports both Zod v3 and v4 schemas. If the schema has a default value,
 * the returned function will return that value when called. If no default is defined,
 * returns undefined.
 *
 * @template T - The type of the Zod schema.
 * @param {T} schema - The Zod schema instance (either v3 or v4).
 * @returns {(() => InferInteropZodOutput<T>) | undefined} A function that returns the default value, or undefined if no default is set.
 */
export function getInteropZodDefaultGetter<T extends InteropZodType>(
  schema: T
): (() => InferInteropZodOutput<T>) | undefined {
  if (isZodSchemaV3(schema)) {
    try {
      const defaultValue = schema.parse(undefined);
      return () => defaultValue as InferInteropZodOutput<T>;
    } catch {
      return undefined;
    }
  }
  if (isZodSchemaV4(schema)) {
    try {
      const defaultValue = parse(schema, undefined);
      return () => defaultValue as InferInteropZodOutput<T>;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
