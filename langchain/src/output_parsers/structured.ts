/* eslint-disable no-else-return */
import { z } from "zod";

import { BaseOutputParser, OutputParserException } from "../schema/index.js";

function printSchema(schema: z.ZodTypeAny, depth = 0): string {
  if (schema instanceof z.ZodString) {
    return "string";
  } else if (schema instanceof z.ZodArray) {
    return `${printSchema(schema._def.type, depth)}[]`;
  } else if (schema instanceof z.ZodObject) {
    const indent = "\t".repeat(depth);
    const indentIn = "\t".repeat(depth + 1);
    return `{
${Object.entries(schema.shape)
  .map(
    ([key, value]) =>
      // eslint-disable-next-line prefer-template
      `${indentIn}"${key}": ${printSchema(value as z.ZodTypeAny, depth + 1)}` +
      ((value as z.ZodTypeAny)._def.description
        ? ` // ${(value as z.ZodTypeAny)._def.description}`
        : "")
  )
  .join("\n")}
${indent}}`;
  } else {
    throw new Error(`Unsupported type: ${schema}`);
  }
}

export class StructuredOutputParser<
  T extends z.AnyZodObject
> extends BaseOutputParser {
  constructor(public schema: T) {
    super();
  }

  static fromZodSchema<T extends z.AnyZodObject>(schema: T) {
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
`;
  }

  async parse(text: string): Promise<z.infer<T>> {
    try {
      const json = text.trim().split("```json")[1].split("```")[0].trim();
      return this.schema.parse(JSON.parse(json));
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: ${text}. Error: ${e}`
      );
    }
  }
}
