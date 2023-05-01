import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export class StructuredInputParser<T extends z.ZodTypeAny> {
  constructor(public schema: T) {}

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
    return `The input data you receive will be a JSON value structured according to a given "JSON Schema" instance.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
would match an object with one required property, an array called "foo". "foo" is semantically described as "a list of test words" by the "description" meta-field, and the items within "foo" must be strings.
Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

If present, the "description" meta-field is the clearest source of semantic information for a schema property.
The property names themselves can be ambiguous, conflicting, or misleading.
Therefore, context from the "description" meta-field should override all other cues.

Here is the input data schema:
\`\`\`json
${JSON.stringify(zodToJsonSchema(this.schema))}
\`\`\`
`;
  }

  async parse(input: z.infer<T>): Promise<string> {
    try {
      const inputData = await this.schema.parseAsync(input);
      return `Here is the previously mentioned input data. Expect it to structurally and semantically match the previously given input schema:
\`\`\`json
${JSON.stringify(inputData)}
\`\`\`
`;
    } catch (e) {
      throw new Error(
        `Failed to parse input. Input: "${
          typeof input === "object" ? JSON.stringify(input, null, 2) : input
        }" Error: ${e}`
      );
    }
  }
}
