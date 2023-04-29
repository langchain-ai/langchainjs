import { z } from "zod";

import { printZodSchema } from "../util/zod.js";

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
    return `The input data you receive will be structured according to the following schema.
If present, the clearest source of semantic information for each field is the provided description (starting with "//") immediately following the field.
The field names themselves or inferences from the schema structure can be ambiguous or misleading.
Therefore, this description should override information from all other contexts.

Input data schema:
\`\`\`json
${printZodSchema(this.schema)}
\`\`\`
`;
  }

  async parse(input: z.infer<T>): Promise<string> {
    try {
      return `Here is the previously mentioned input data. Expect it to structurally and semantically match the previously given input schema:
\`\`\`json
${JSON.stringify(this.schema.parse(input))}
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
