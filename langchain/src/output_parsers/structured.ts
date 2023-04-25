import { z } from "zod";
import {
  BaseOutputParser,
  OutputParserException,
} from "../schema/output_parser.js";

function printSchema(schema: z.ZodTypeAny, depth = 0): string {
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
  if (schema._def.typeName === "ZodNullable") {
    return `${printSchema(schema._def.innerType, depth)} // Nullable`;
  }
  if (schema._def.typeName === "ZodTransformer") {
    return `${printSchema(schema._def.schema, depth)}`;
  }
  if (schema._def.typeName === "ZodOptional") {
    return `${printSchema(schema._def.innerType, depth)} // Optional`;
  }
  if (schema._def.typeName === "ZodArray") {
    return `${printSchema(schema._def.type, depth)}[]`;
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
      `${indentIn}"${key}": ${printSchema(value as z.ZodTypeAny, depth + 1)}${
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

export class StructuredOutputParser<
  T extends z.ZodTypeAny
> extends BaseOutputParser<z.infer<T>> {
  constructor(public schema: T) {
    super();
  }

  static fromZodSchema<T extends z.ZodTypeAny>(schema: T) {
    return new this(schema);
  }

  static fromNamesAndDescriptions<S extends { [key: string]: string }>(
    schemas: S
  ) {
    const zodSchema = z.object(
      Object.fromEntries(
        Object.entries(schemas).map(
          ([name, description]) =>
            [name, z.string().describe(description)] as const
        )
      )
    );

    return new this(zodSchema);
  }

  getFormatInstructions(): string {
    return `The output should be a markdown code snippet formatted in the following schema:

\`\`\`json
${printSchema(this.schema)}
\`\`\`

Including the leading and trailing "\`\`\`json" and "\`\`\`"
`;
  }

  async parse(text: string): Promise<z.infer<T>> {
    try {
      const json = text.trim().split("```json")[1].split("```")[0].trim();
      return this.schema.parse(JSON.parse(json));
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${text}". Error: ${e}`
      );
    }
  }
}
