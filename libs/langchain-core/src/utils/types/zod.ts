/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  parse,
  parseAsync,
  globalRegistry,
  util,
  clone,
  _unknown,
  _never,
  $ZodUnknown,
  $ZodNever,
  $ZodOptional,
} from "zod/v4/core";

// Internal-only type import – used for casts inside function bodies.
// Never appears in exported type signatures, so it won't leak into
// downstream .d.ts files or trigger cross-version structural comparisons.
import type * as z4 from "zod/v4/core";

import { SerializableSchema } from "../standard_schema.js";

// @langchain/core's public API exposes types like `InteropZodType` (a union
// of Zod v3 and v4 schema types) in function signatures, class properties,
// and generic constraints.  When those types were defined in terms of the
// *real* Zod type imports (`z3.ZodType`, `z4.$ZodType`), they worked fine as
// long as every package in the workspace resolved the exact same Zod version.
//
// In practice that assumption breaks.  Zod 4 re-exports Zod 3 under
// `zod/v3`, but different packages can still resolve to different *copies*
// of Zod (e.g. `zod@3.25.x` vs `zod@4.x`) depending on their own lockfile
// or hoisting.  When that happens, TypeScript sees two structurally-similar
// but *nominally-different* types and falls back to a full structural
// comparison.
//
// The real Zod types are massive: ~3,400+ lines of deeply-nested,
// mutually-recursive generics (`ZodType` → `ZodTypeDef` → `ZodEffects` →
// `ZodType` → …).  A structural comparison walks every branch of this tree
// for *every* callsite that touches an `InteropZodType`.  In a large
// monorepo this quickly causes:
//
//   • The TypeScript language server becoming unresponsive
//   • `tsc` exhausting the default heap and OOM-ing
//   • "Type instantiation is excessively deep and possibly infinite" errors
//
// We replace every Zod type that appears in an *exported* signature with the
// minimal structural interface defined below.  Each interface captures only
// the properties that @langchain/core actually reads at runtime (e.g.
// `_type`, `_output`, `_def`, `parse`, `_zod.def.type`, etc.).
//
// Because these interfaces are plain object shapes with no imports from the
// `zod` package, TypeScript can check assignability in O(1) — there is
// nothing recursive to walk.  A real `z3.ZodString` or `z4.$ZodString` is
// still assignable to `ZodV3Like<string>` or `ZodV4Like<string>` (they have
// the required properties), so call-site compatibility is preserved.

export interface ZodV3TypeDef {
  typeName?: string;
  description?: string;
  [key: string]: any;
}

export interface ZodV3Like<Output = any, Input = Output> {
  readonly _type: Output;
  readonly _output: Output;
  readonly _input: Input;
  readonly _def: ZodV3TypeDef;
  readonly description?: string;
  parse(data: unknown, params?: any): Output;
  safeParse(
    data: unknown,
    params?: any
  ): { success: boolean; data?: Output; error?: unknown };
  parseAsync(data: unknown, params?: any): Promise<Output>;
  safeParseAsync(
    data: unknown,
    params?: any
  ): Promise<{ success: boolean; data?: Output; error?: unknown }>;
  optional?(): ZodV3Like<Output | undefined, Input | undefined>;
  "~standard"?: any;
}

export interface ZodV3ObjectLike extends ZodV3Like {
  readonly shape: Record<string, any>;
  extend(augmentation: Record<string, any>): ZodV3ObjectLike;
  partial(): ZodV3ObjectLike;
  strict(): ZodV3ObjectLike;
  passthrough(): ZodV3ObjectLike;
}

export interface ZodV4Internals<O = any, I = any> {
  def: any;
  output: O;
  input: I;
  [key: string]: any;
}

export interface ZodV4Like<Output = any, Input = Output> {
  _zod: ZodV4Internals<Output, Input>;
  "~standard"?: any;
}

export interface ZodV4ObjectLike extends ZodV4Like {
  _zod: ZodV4Internals & {
    def: { type: "object"; shape: Record<string, any>; [key: string]: any };
  };
}

export interface ZodV4ArrayLike extends ZodV4Like {
  _zod: ZodV4Internals & {
    def: { type: "array"; element: ZodV4Like; [key: string]: unknown };
  };
}

export interface ZodV4OptionalLike extends ZodV4Like {
  _zod: ZodV4Internals & {
    def: { type: "optional"; innerType: ZodV4Like; [key: string]: unknown };
  };
}

export interface ZodV4NullableLike extends ZodV4Like {
  _zod: ZodV4Internals & {
    def: { type: "nullable"; innerType: ZodV4Like; [key: string]: unknown };
  };
}

export interface ZodV4PipeLike extends ZodV4Like {
  _zod: ZodV4Internals & {
    def: { type: "pipe"; in: InteropZodType; [key: string]: unknown };
    [key: string]: unknown;
  };
}

export interface ZodV3EffectsLike extends ZodV3Like {
  _def: ZodV3TypeDef & {
    typeName: "ZodEffects";
    schema: InteropZodType;
  };
}

// Aliases

export type ZodStringV3 = ZodV3Like<string>;
export type ZodStringV4 = ZodV4Like<string, unknown>;

export type ZodObjectV3 = ZodV3ObjectLike;
export type ZodObjectV4 = ZodV4ObjectLike;
export type ZodObjectV4Classic = ZodV4ObjectLike;
export type ZodObjectMain = ZodV4ObjectLike;

export type ZodDefaultV3<T extends ZodV3Like> = ZodV3Like<
  T extends ZodV3Like<infer O, any> ? O : any
>;
export type ZodDefaultV4<T extends ZodV4Like> = ZodV4Like<
  T extends ZodV4Like<infer O, any> ? O : any
>;
export type ZodOptionalV3<T extends ZodV3Like> = ZodV3Like<
  T extends ZodV3Like<infer O, any> ? O | undefined : any
>;
export type ZodOptionalV4<T extends ZodV4Like> = ZodV4Like<
  T extends ZodV4Like<infer O, any> ? O | undefined : any
>;
export type ZodNullableV4<T extends ZodV4Like> = ZodV4Like<
  T extends ZodV4Like<infer O, any> ? O | null : any
>;

// Interop types

export type InteropZodType<Output = any, Input = Output> =
  | ZodV3Like<Output, Input>
  | ZodV4Like<Output, Input>;

export type InteropZodObject = ZodV3ObjectLike | ZodV4ObjectLike;

export type InteropZodDefault<T = InteropZodObject> = T extends ZodV3Like
  ? ZodDefaultV3<T>
  : T extends ZodV4Like
    ? ZodDefaultV4<T>
    : never;

export type InteropZodOptional<T = InteropZodObject> = T extends ZodV3Like
  ? ZodOptionalV3<T>
  : T extends ZodV4Like
    ? ZodOptionalV4<T>
    : never;

export type InteropZodObjectShape<
  T extends InteropZodObject = InteropZodObject,
> = T extends ZodV3ObjectLike
  ? { [K in keyof T["shape"]]: T["shape"][K] }
  : T extends ZodV4ObjectLike
    ? { [K in keyof T["_zod"]["def"]["shape"]]: T["_zod"]["def"]["shape"][K] }
    : never;

export interface InteropZodIssue {
  message: string;
  path: (string | number)[];
  [key: string]: unknown;
}

export type InferInteropZodInput<T> =
  T extends ZodV3Like<unknown, infer Input>
    ? Input
    : T extends ZodV4Like<unknown, infer Input>
      ? Input
      : T extends { _zod: { input: infer Input } }
        ? Input
        : never;

export type InferInteropZodOutput<T> =
  T extends ZodV3Like<infer Output, unknown>
    ? Output
    : T extends ZodV4Like<infer Output, unknown>
      ? Output
      : T extends { _zod: { output: infer Output } }
        ? Output
        : never;

export type InteropZodLiteral = ZodV3Like | ZodV4Like;

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export function isZodSchemaV4(
  schema: unknown
): schema is ZodV4Like<unknown, unknown> {
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
): schema is ZodV3Like<unknown, unknown> {
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
  RunOutput extends Record<string, unknown> = Record<string, unknown>,
>(
  schema: ZodV3Like<RunOutput> | Record<string, unknown>
): schema is ZodV3Like<RunOutput> {
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
  if (isZodSchemaV4(input) || isZodSchemaV3(input)) {
    return true;
  }
  return false;
}

export function isZodLiteralV3(obj: unknown): obj is ZodV3Like {
  // Zod v3 literal schemas have _def.typeName === "ZodLiteral"
  if (
    typeof obj === "object" &&
    obj !== null &&
    "_def" in obj &&
    typeof obj._def === "object" &&
    obj._def !== null &&
    "typeName" in obj._def &&
    obj._def.typeName === "ZodLiteral"
  ) {
    return true;
  }
  return false;
}

export function isZodLiteralV4(obj: unknown): obj is ZodV4Like {
  if (!isZodSchemaV4(obj)) return false;
  // Zod v4 literal schemas have _zod.def.type === "literal"
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
    obj._zod.def.type === "literal"
  ) {
    return true;
  }
  return false;
}

/**
 * Determines if the provided value is an InteropZodLiteral (Zod v3 or v4 literal schema).
 *
 * @param obj The value to check.
 * @returns {boolean} True if the value is a Zod v3 or v4 literal schema, false otherwise.
 */
export function isInteropZodLiteral(obj: unknown): obj is InteropZodLiteral {
  if (isZodLiteralV3(obj)) return true;
  if (isZodLiteralV4(obj)) return true;
  return false;
}

export interface InteropZodError {
  issues: InteropZodIssue[];
}

type InteropZodSafeParseResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: InteropZodError; data?: never };

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
      const data = await parseAsync(schema as z4.$ZodType<T>, input);
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error as InteropZodError,
      };
    }
  }
  if (isZodSchemaV3(schema)) {
    return (await schema.safeParseAsync(input)) as InteropZodSafeParseResult<T>;
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
    return await parseAsync(schema as z4.$ZodType<T>, input);
  }
  if (isZodSchemaV3(schema)) {
    return await schema.parseAsync(input);
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
      const data = parse(schema as z4.$ZodType<T>, input);
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error as InteropZodError,
      };
    }
  }
  if (isZodSchemaV3(schema)) {
    return schema.safeParse(input) as InteropZodSafeParseResult<T>;
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
    return parse(schema as z4.$ZodType<T>, input);
  }
  if (isZodSchemaV3(schema)) {
    return schema.parse(input);
  }
  throw new Error("Schema must be an instance of z3.ZodType or z4.$ZodType");
}

/**
 * Retrieves the description from a schema definition (v3, v4, standard schema, or plain object), if available.
 *
 * @param {unknown} schema - The schema to extract the description from.
 * @returns {string | undefined} The description of the schema, or undefined if not present.
 */
export function getSchemaDescription(
  schema: SerializableSchema | InteropZodType<unknown> | Record<string, unknown>
): string | undefined {
  if (isZodSchemaV4(schema)) {
    return globalRegistry.get(schema as z4.$ZodType)?.description;
  }
  if (isZodSchemaV3(schema)) {
    return schema.description;
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
  if (isZodSchemaV3(schema)) {
    const def = schema._def;

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
  if (isZodSchemaV3(schema)) {
    const def = schema._def;

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

export function isZodObjectV3(obj: unknown): obj is ZodObjectV3 {
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
  return false;
}

export function isZodObjectV4(obj: unknown): obj is ZodV4ObjectLike {
  if (!isZodSchemaV4(obj)) return false;
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
  return false;
}

export function isZodArrayV4(obj: unknown): obj is ZodV4ArrayLike {
  if (!isZodSchemaV4(obj)) return false;
  // Zod v4 array schemas have _zod.def.type === "array"
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
    obj._zod.def.type === "array"
  ) {
    return true;
  }
  return false;
}

export function isZodOptionalV4(obj: unknown): obj is ZodV4OptionalLike {
  if (!isZodSchemaV4(obj)) return false;
  // Zod v4 optional schemas have _zod.def.type === "optional"
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
    obj._zod.def.type === "optional"
  ) {
    return true;
  }
  return false;
}

export function isZodNullableV4(obj: unknown): obj is ZodV4NullableLike {
  if (!isZodSchemaV4(obj)) return false;
  // Zod v4 nullable schemas have _zod.def.type === "nullable"
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
    obj._zod.def.type === "nullable"
  ) {
    return true;
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
  if (isZodObjectV3(obj)) return true;
  if (isZodObjectV4(obj)) return true;
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
    return schema.shape as InteropZodObjectShape<T>;
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
    return schema.extend(extension);
  }
  if (isZodSchemaV4(schema)) {
    return util.extend(schema as z4.$ZodObject, extension);
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
    return util.partial($ZodOptional, schema as z4.$ZodObject, undefined);
  }
  throw new Error(
    "Schema must be an instance of z3.ZodObject or z4.$ZodObject"
  );
}

/**
 * Returns a strict version of a Zod object schema, disallowing unknown keys.
 * Supports both Zod v3 and v4 object schemas. If `recursive` is true, applies strictness
 * recursively to all nested object schemas and arrays of object schemas.
 *
 * @template T - The type of the Zod object schema.
 * @param {T} schema - The Zod object schema instance (either v3 or v4).
 * @param {boolean} [recursive=false] - Whether to apply strictness recursively to nested objects/arrays.
 * @returns {InteropZodObject} The strict Zod object schema.
 * @throws {Error} If the schema is not a Zod v3 or v4 object.
 */
export function interopZodObjectStrict<T extends InteropZodObject>(
  schema: T,
  recursive = false
): InteropZodObject {
  if (isZodObjectV3(schema)) {
    // TODO: v3 schemas aren't recursively handled here
    // (currently not necessary since zodToJsonSchema handles this)
    return schema.strict();
  }
  if (isZodObjectV4(schema)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outputShape: Record<string, any> = schema._zod.def.shape;
    if (recursive) {
      for (const [key, keySchema] of Object.entries(schema._zod.def.shape)) {
        // If the shape key is a v4 object schema, we need to make it strict
        if (isZodObjectV4(keySchema)) {
          const outputSchema = interopZodObjectStrict(keySchema, recursive);
          outputShape[key] = outputSchema;
        }
        // If the shape key is a v4 array schema, we need to make the element
        // schema strict if it's an object schema
        else if (isZodArrayV4(keySchema)) {
          let elementSchema = keySchema._zod.def.element;
          if (isZodObjectV4(elementSchema)) {
            elementSchema = interopZodObjectStrict(elementSchema, recursive);
          }
          outputShape[key] = clone(keySchema as unknown as z4.$ZodType, {
            ...keySchema._zod.def,
            element: elementSchema,
          });
        }
        // Otherwise, just use the keySchema
        else {
          outputShape[key] = keySchema;
        }
        // Assign meta fields to the keySchema
        const meta = globalRegistry.get(keySchema as z4.$ZodType);
        if (meta) globalRegistry.add(outputShape[key] as z4.$ZodType, meta);
      }
    }
    const modifiedSchema = clone<z4.$ZodObject>(schema as z4.$ZodObject, {
      ...schema._zod.def,
      shape: outputShape,
      catchall: _never($ZodNever),
    });
    const meta = globalRegistry.get(schema as unknown as z4.$ZodType);
    if (meta) globalRegistry.add(modifiedSchema, meta);
    return modifiedSchema;
  }
  throw new Error(
    "Schema must be an instance of z3.ZodObject or z4.$ZodObject"
  );
}

/**
 * Returns a passthrough version of a Zod object schema, allowing unknown keys.
 * Supports both Zod v3 and v4 object schemas. If `recursive` is true, applies passthrough
 * recursively to all nested object schemas and arrays of object schemas.
 *
 * @template T - The type of the Zod object schema.
 * @param {T} schema - The Zod object schema instance (either v3 or v4).
 * @param {boolean} [recursive=false] - Whether to apply passthrough recursively to nested objects/arrays.
 * @returns {InteropZodObject} The passthrough Zod object schema.
 * @throws {Error} If the schema is not a Zod v3 or v4 object.
 */
export function interopZodObjectPassthrough<T extends InteropZodObject>(
  schema: T,
  recursive: boolean = false
): InteropZodObject {
  if (isZodObjectV3(schema)) {
    // TODO: v3 schemas aren't recursively handled here
    // (currently not necessary since zodToJsonSchema handles this)
    return schema.passthrough();
  }
  if (isZodObjectV4(schema)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outputShape: Record<string, any> = schema._zod.def.shape;
    if (recursive) {
      for (const [key, keySchema] of Object.entries(schema._zod.def.shape)) {
        // If the shape key is a v4 object schema, we need to make it passthrough
        if (isZodObjectV4(keySchema)) {
          const outputSchema = interopZodObjectPassthrough(
            keySchema,
            recursive
          );
          outputShape[key] = outputSchema;
        }
        // If the shape key is a v4 array schema, we need to make the element
        // schema passthrough if it's an object schema
        else if (isZodArrayV4(keySchema)) {
          let elementSchema = keySchema._zod.def.element;
          if (isZodObjectV4(elementSchema)) {
            elementSchema = interopZodObjectPassthrough(
              elementSchema,
              recursive
            ) as ZodV4ObjectLike;
          }
          outputShape[key] = clone(keySchema as unknown as z4.$ZodType, {
            ...keySchema._zod.def,
            element: elementSchema,
          });
        }
        // Otherwise, just use the keySchema
        else {
          outputShape[key] = keySchema;
        }
        // Assign meta fields to the keySchema
        const meta = globalRegistry.get(keySchema as z4.$ZodType);
        if (meta) globalRegistry.add(outputShape[key] as z4.$ZodType, meta);
      }
    }
    const modifiedSchema = clone<z4.$ZodObject>(schema as z4.$ZodObject, {
      ...schema._zod.def,
      shape: outputShape,
      catchall: _unknown($ZodUnknown),
    });
    const meta = globalRegistry.get(schema as unknown as z4.$ZodType);
    if (meta) globalRegistry.add(modifiedSchema, meta);
    return modifiedSchema as InteropZodObject;
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
      const defaultValue = parse(schema as z4.$ZodType, undefined);
      return () => defaultValue as InferInteropZodOutput<T>;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isZodTransformV3(schema: InteropZodType): schema is ZodV3EffectsLike {
  return (
    isZodSchemaV3(schema) &&
    "typeName" in schema._def &&
    schema._def.typeName === "ZodEffects"
  );
}

function isZodTransformV4(schema: InteropZodType): schema is ZodV4PipeLike {
  return isZodSchemaV4(schema) && schema._zod.def.type === "pipe";
}

function interopZodTransformInputSchemaImpl(
  schema: InteropZodType,
  recursive: boolean,
  cache: WeakMap<InteropZodType, InteropZodType>
): InteropZodType {
  const cached = cache.get(schema);
  if (cached !== undefined) {
    return cached;
  }

  // Zod v3: ._def.schema is the input schema for ZodEffects (transform)
  if (isZodSchemaV3(schema)) {
    if (isZodTransformV3(schema)) {
      return interopZodTransformInputSchemaImpl(
        schema._def.schema,
        recursive,
        cache
      );
    }
    // TODO: v3 schemas aren't recursively handled here
    // (currently not necessary since zodToJsonSchema handles this)
    return schema;
  }

  // Zod v4: _def.type is the input schema for ZodEffects (transform)
  if (isZodSchemaV4(schema)) {
    let outputSchema: InteropZodType = schema;
    if (isZodTransformV4(schema)) {
      outputSchema = interopZodTransformInputSchemaImpl(
        schema._zod.def.in,
        recursive,
        cache
      );
    }
    if (recursive) {
      // Handle nested object schemas
      if (isZodObjectV4(outputSchema)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const outputShape: Record<string, any> = {};
        for (const [key, keySchema] of Object.entries(
          outputSchema._zod.def.shape
        )) {
          outputShape[key] = interopZodTransformInputSchemaImpl(
            keySchema as InteropZodType,
            recursive,
            cache
          );
        }
        outputSchema = clone<z4.$ZodObject>(outputSchema as z4.$ZodObject, {
          ...outputSchema._zod.def,
          shape: outputShape,
        }) as InteropZodType;
      }
      // Handle nested array schemas
      else if (isZodArrayV4(outputSchema)) {
        const elementSchema = interopZodTransformInputSchemaImpl(
          outputSchema._zod.def.element as InteropZodType,
          recursive,
          cache
        );
        outputSchema = clone<z4.$ZodArray>(
          outputSchema as unknown as z4.$ZodArray,
          {
            ...outputSchema._zod.def,
            element: elementSchema as z4.$ZodType,
          }
        ) as InteropZodType;
      }
      // Handle optional schemas
      else if (isZodOptionalV4(outputSchema)) {
        const innerSchema = interopZodTransformInputSchemaImpl(
          outputSchema._zod.def.innerType as InteropZodType,
          recursive,
          cache
        );
        outputSchema = clone<z4.$ZodOptional>(
          outputSchema as unknown as z4.$ZodOptional,
          {
            ...outputSchema._zod.def,
            innerType: innerSchema as z4.$ZodType,
          }
        ) as InteropZodType;
      }
      // Handle nullable schemas
      else if (isZodNullableV4(outputSchema)) {
        const innerSchema = interopZodTransformInputSchemaImpl(
          outputSchema._zod.def.innerType as InteropZodType,
          recursive,
          cache
        );
        outputSchema = clone<z4.$ZodNullable>(
          outputSchema as unknown as z4.$ZodNullable,
          {
            ...outputSchema._zod.def,
            innerType: innerSchema as z4.$ZodType,
          }
        ) as InteropZodType;
      }
    }
    const meta = globalRegistry.get(schema as z4.$ZodType);
    if (meta) globalRegistry.add(outputSchema as z4.$ZodType, meta);
    cache.set(schema, outputSchema);
    return outputSchema;
  }

  throw new Error("Schema must be an instance of z3.ZodType or z4.$ZodType");
}

/**
 * Returns the input type of a Zod transform schema, for both v3 and v4.
 * If the schema is not a transform, returns undefined. If `recursive` is true,
 * recursively processes nested object schemas and arrays of object schemas.
 *
 * @param schema - The Zod schema instance (v3 or v4)
 * @param {boolean} [recursive=false] - Whether to recursively process nested objects/arrays.
 * @returns The input Zod schema of the transform, or undefined if not a transform
 */
export function interopZodTransformInputSchema(
  schema: InteropZodType,
  recursive = false
): InteropZodType {
  const cache = new WeakMap<InteropZodType, InteropZodType>();
  return interopZodTransformInputSchemaImpl(schema, recursive, cache);
}

/**
 * Creates a modified version of a Zod object schema where fields matching a predicate are made optional.
 * Supports both Zod v3 and v4 schemas and preserves the original schema version.
 *
 * @template T - The type of the Zod object schema.
 * @param {T} schema - The Zod object schema instance (either v3 or v4).
 * @param {(key: string, value: InteropZodType) => boolean} predicate - Function to determine which fields should be optional.
 * @returns {InteropZodObject} The modified Zod object schema.
 * @throws {Error} If the schema is not a Zod v3 or v4 object.
 */
export function interopZodObjectMakeFieldsOptional<T extends InteropZodObject>(
  schema: T,
  predicate: (key: string, value: InteropZodType) => boolean
): InteropZodObject {
  if (isZodSchemaV3(schema)) {
    const shape = getInteropZodObjectShape(schema as InteropZodObject);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modifiedShape: Record<string, any> = {};

    for (const [key, value] of Object.entries(shape)) {
      if (predicate(key, value as InteropZodType)) {
        // Make this field optional using v3 methods
        modifiedShape[key] = value.optional();
      } else {
        // Keep field as-is
        modifiedShape[key] = value;
      }
    }

    // Use v3's extend method to create a new schema with the modified shape
    return schema.extend(modifiedShape) as InteropZodObject;
  }

  if (isZodSchemaV4(schema)) {
    const shape = getInteropZodObjectShape(schema as InteropZodObject);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outputShape: Record<string, any> = {
      ...schema._zod.def.shape,
    };

    for (const [key, value] of Object.entries(shape)) {
      if (predicate(key, value as InteropZodType)) {
        // Make this field optional using v4 methods
        outputShape[key] = new $ZodOptional({
          type: "optional" as const,
          innerType: value as z4.$ZodType,
        });
      }
      // Otherwise keep the field as-is (already in outputShape)
    }

    const modifiedSchema = clone<z4.$ZodObject>(schema as z4.$ZodObject, {
      ...schema._zod.def,
      shape: outputShape,
    });

    // Preserve metadata
    const meta = globalRegistry.get(schema as unknown as z4.$ZodType);
    if (meta) globalRegistry.add(modifiedSchema, meta);

    return modifiedSchema as InteropZodObject;
  }

  throw new Error(
    "Schema must be an instance of z3.ZodObject or z4.$ZodObject"
  );
}

export function isInteropZodError(e: unknown) {
  return (
    // eslint-disable-next-line no-instanceof/no-instanceof
    e instanceof Error &&
    (e.constructor.name === "ZodError" || e.constructor.name === "$ZodError")
  );
}
