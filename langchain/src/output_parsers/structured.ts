/* eslint-disable no-else-return */
import { z } from "zod";

import { BaseOutputParser, SerializedOutputParser } from "./base.js";

function printSchema(schema: z.ZodObject<any>): string {
  return `{
${Object.entries(schema.shape)
  .map(([key, value]) => {
    if (value instanceof z.ZodString) {
      return `\t"${key}": string // ${value._def.description}`;
    } else if (value instanceof z.ZodArray) {
      return `\t"${key}": ${printSchema(value._def.type)}[] // ${
        value._def.description
      }`;
    } else if (value instanceof z.ZodObject) {
      return `\t"${key}": ${printSchema(value)} // ${value._def.description}`;
    } else {
      throw new Error(`Unsupported type: ${value}`);
    }
  })
  .join("\n")}
}`;
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

  parse(text: string): z.infer<T> {
    const json = text.trim().split("```json")[1].split("```")[0].trim();
    return this.schema.parse(JSON.parse(json));
  }

  serialize(): SerializedOutputParser {
    throw new Error("Not implemented");
  }
}
