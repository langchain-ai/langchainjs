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
    return `You must format your output as a JSON value that adheres to a given "JSON Schema" instance.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!

Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:
\`\`\`json
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
