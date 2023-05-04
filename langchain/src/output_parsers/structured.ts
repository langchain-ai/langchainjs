import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  BaseOutputParser,
  OutputParserException,
} from "../schema/output_parser.js";

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
    return `The output should be formatted as a JSON instance that conforms to the JSON schema below.

As an example, for the schema {{"properties": {{"foo": {{"title": "Foo", "description": "a list of strings", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of the schema. The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Here is the output schema:
\`\`\`
${JSON.stringify(zodToJsonSchema(this.schema))}
\`\`\`
`;
  }

  async parse(text: string): Promise<z.infer<T>> {
    try {
      const json = text.includes("```")
        ? text.trim().split(/```(?:json)?/)[1]
        : text.trim();
      return this.schema.parseAsync(JSON.parse(json));
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${text}". Error: ${e}`,
        text
      );
    }
  }
}
