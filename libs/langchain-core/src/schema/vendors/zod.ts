import type { JSONSchema7 } from "json-schema";
import type { ZodType as ZodTypeV3 } from "zod/v3";
import type { $ZodType as ZodTypeV4 } from "zod/v4/core";
import type { $SchemaSerializer } from "../index.js";

const importMap = new Map<string, unknown>();

export async function memoizeImport<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  if (importMap.has(key)) {
    return importMap.get(key) as T;
  }
  const mod = await fn();
  importMap.set(key, mod);
  return mod;
}

declare module "zod/v3" {
  interface ZodType {
    "~standard-json": never;
  }
}

declare module "zod/v4/core" {
  interface $ZodType {
    "~standard-json": never;
  }
}

function isZodSchemaV3(schema: unknown): schema is ZodTypeV3 {
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

function isZodSchemaV4(schema: unknown): schema is ZodTypeV4 {
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

export const serializer: $SchemaSerializer = async (schema) => {
  if (isZodSchemaV3(schema)) {
    try {
      const { zodToJsonSchema } = await memoizeImport(
        "zod-to-json-schema",
        () => import("zod-to-json-schema")
      );
      return zodToJsonSchema(schema, { target: "jsonSchema7" }) as JSONSchema7;
    } catch {
      throw new Error(
        `langchain: Missing zod v3 dependencies "zod-to-json-schema"`
      );
    }
  }
  if (isZodSchemaV4(schema)) {
    try {
      const { toJSONSchema } = await memoizeImport(
        "zod/v4/core",
        () => import("zod/v4/core")
      );
      return toJSONSchema(schema, { target: "draft-7" }) as JSONSchema7;
    } catch {
      throw new Error(`langchain: Missing zod v4 dependencies "zod"`);
    }
  }
  throw new Error(`langchain: Unsupported zod schema`);
};
