import { z, util } from "zod";

export function printZodSchema(schema: z.ZodTypeAny, depth = 0): string {
  if (
    schema._def.typeName === "ZodString" &&
    (schema as z.ZodString)._def.checks.some(
      (check) => check.kind === "datetime"
    )
  ) {
    return "datetime";
  }
  if (schema._def.typeName === "ZodString") {
    return "string";
  }
  if (schema._def.typeName === "ZodNumber") {
    return "number";
  }
  if (schema._def.typeName === "ZodBoolean") {
    return "boolean";
  }
  if (schema._def.typeName === "ZodDate") {
    return "date";
  }
  if (schema._def.typeName === "ZodEnum") {
    return (schema as z.ZodEnum<[string, ...string[]]>).options
      .map((value) => `"${value}"`)
      .join(" | ");
  }
  if (schema._def.typeName === "ZodNativeEnum") {
    return util
      .getValidEnumValues((schema as z.ZodNativeEnum<never>)._def.values)
      .map((value) => `"${value}"`)
      .join(" | ");
  }
  if (schema._def.typeName === "ZodNullable") {
    return `${printZodSchema(schema._def.innerType, depth)} // Nullable`;
  }
  if (schema._def.typeName === "ZodTransformer") {
    return `${printZodSchema(schema._def.schema, depth)}`;
  }
  if (schema._def.typeName === "ZodOptional") {
    return `${printZodSchema(schema._def.innerType, depth)} // Optional`;
  }
  if (schema._def.typeName === "ZodArray") {
    return `${printZodSchema(schema._def.type, depth)}[]`;
  }
  if (schema._def.typeName === "ZodObject") {
    const indent = "\t".repeat(depth);
    const indentIn = "\t".repeat(depth + 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { shape } = schema as z.ZodObject<any>;
    return `{${schema._def.description ? ` // ${schema._def.description}` : ""}
${Object.entries(shape)
  .map(
    ([key, value]) =>
      `${indentIn}"${key}": ${printZodSchema(
        value as z.ZodTypeAny,
        depth + 1
      )}${
        (value as z.ZodTypeAny)._def.description
          ? ` // ${(value as z.ZodTypeAny)._def.description}`
          : ""
      }`
  )
  .join("\n")}
${indent}}`;
  }

  throw new Error(`Unsupported type: ${schema._def.typeName}`);
}
