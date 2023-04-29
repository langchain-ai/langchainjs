import { z } from "zod";
import { printZodSchema } from "../util/zod.js";

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
    return `Your output must be a markdown code snippet formatted in the following schema:

\`\`\`json
${printZodSchema(this.schema)}
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
