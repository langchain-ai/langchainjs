import { z } from "zod";
import {
  zodToJsonSchema,
  JsonSchema7Type,
  JsonSchema7ArrayType,
  JsonSchema7ObjectType,
  JsonSchema7StringType,
  JsonSchema7NumberType,
  JsonSchema7NullableType,
} from "zod-to-json-schema";
import {
  BaseOutputParser,
  FormatInstructionsOptions,
  OutputParserException,
} from "@langchain/core/output_parsers";

export type JsonMarkdownStructuredOutputParserInput = {
  interpolationDepth?: number;
};

export interface JsonMarkdownFormatInstructionsOptions
  extends FormatInstructionsOptions {
  interpolationDepth?: number;
}

export class StructuredOutputParser<
  T extends z.ZodTypeAny
> extends BaseOutputParser<z.infer<T>> {
  static lc_name() {
    return "StructuredOutputParser";
  }

  lc_namespace = ["langchain", "output_parsers", "structured"];

  toJSON() {
    return this.toJSONNotImplemented();
  }

  constructor(public schema: T) {
    super(schema);
  }

  /**
   * Creates a new StructuredOutputParser from a Zod schema.
   * @param schema The Zod schema which the output should match
   * @returns A new instance of StructuredOutputParser.
   */
  static fromZodSchema<T extends z.ZodTypeAny>(schema: T) {
    return new this(schema);
  }

  /**
   * Creates a new StructuredOutputParser from a set of names and
   * descriptions.
   * @param schemas An object where each key is a name and each value is a description
   * @returns A new instance of StructuredOutputParser.
   */
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

  /**
   * Returns a markdown code snippet with a JSON object formatted according
   * to the schema.
   * @param options Optional. The options for formatting the instructions
   * @returns A markdown code snippet with a JSON object formatted according to the schema.
   */
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

  /**
   * Parses the given text according to the schema.
   * @param text The text to parse
   * @returns The parsed output.
   */
  async parse(text: string): Promise<z.infer<T>> {
    try {
      const json = text.includes("```")
        ? text.trim().split(/```(?:json)?/)[1]
        : text.trim();
      return await this.schema.parseAsync(JSON.parse(json));
    } catch (e) {
      try {
        return await this.schema.parseAsync(JSON.parse(text.trim()));
      } catch (e2) {
        throw new OutputParserException(
          `Failed to parse. Text: "${text}". Error: ${e2}`,
          text
        );
      }
    }
  }
}

/**
 * A specific type of `StructuredOutputParser` that parses JSON data
 * formatted as a markdown code snippet.
 */
export class JsonMarkdownStructuredOutputParser<
  T extends z.ZodTypeAny
> extends StructuredOutputParser<T> {
  static lc_name() {
    return "JsonMarkdownStructuredOutputParser";
  }

  getFormatInstructions(
    options?: JsonMarkdownFormatInstructionsOptions
  ): string {
    const interpolationDepth = options?.interpolationDepth ?? 1;
    if (interpolationDepth < 1) {
      throw new Error("f string interpolation depth must be at least 1");
    }

    return `Return a markdown code snippet with a JSON object formatted to look like:\n\`\`\`json\n${this._schemaToInstruction(
      zodToJsonSchema(this.schema)
    )
      .replaceAll("{", "{".repeat(interpolationDepth))
      .replaceAll("}", "}".repeat(interpolationDepth))}\n\`\`\``;
  }

  private _schemaToInstruction(
    schemaInput: JsonSchema7Type,
    indent = 2
  ): string {
    const schema = schemaInput as Extract<
      JsonSchema7Type,
      | JsonSchema7ObjectType
      | JsonSchema7ArrayType
      | JsonSchema7StringType
      | JsonSchema7NumberType
      | JsonSchema7NullableType
    >;

    if ("type" in schema) {
      let nullable = false;
      let type: string;
      if (Array.isArray(schema.type)) {
        const nullIdx = schema.type.findIndex((type) => type === "null");
        if (nullIdx !== -1) {
          nullable = true;
          schema.type.splice(nullIdx, 1);
        }
        type = schema.type.join(" | ") as string;
      } else {
        type = schema.type;
      }

      if (schema.type === "object" && schema.properties) {
        const description = schema.description
          ? ` // ${schema.description}`
          : "";
        const properties = Object.entries(schema.properties)
          .map(([key, value]) => {
            const isOptional = schema.required?.includes(key)
              ? ""
              : " (optional)";
            return `${" ".repeat(indent)}"${key}": ${this._schemaToInstruction(
              value,
              indent + 2
            )}${isOptional}`;
          })
          .join("\n");
        return `{\n${properties}\n${" ".repeat(indent - 2)}}${description}`;
      }
      if (schema.type === "array" && schema.items) {
        const description = schema.description
          ? ` // ${schema.description}`
          : "";
        return `array[\n${" ".repeat(indent)}${this._schemaToInstruction(
          schema.items,
          indent + 2
        )}\n${" ".repeat(indent - 2)}] ${description}`;
      }
      const isNullable = nullable ? " (nullable)" : "";
      const description = schema.description ? ` // ${schema.description}` : "";
      return `${type}${description}${isNullable}`;
    }

    if ("anyOf" in schema) {
      return schema.anyOf
        .map((s) => this._schemaToInstruction(s, indent))
        .join(`\n${" ".repeat(indent - 2)}`);
    }

    throw new Error("unsupported schema type");
  }

  static fromZodSchema<T extends z.ZodTypeAny>(schema: T) {
    return new this<T>(schema);
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

    return new this<typeof zodSchema>(zodSchema);
  }
}

export interface AsymmetricStructuredOutputParserFields<
  T extends z.ZodTypeAny
> {
  inputSchema: T;
}

/**
 * A type of `StructuredOutputParser` that handles asymmetric input and
 * output schemas.
 */
export abstract class AsymmetricStructuredOutputParser<
  T extends z.ZodTypeAny,
  Y = unknown
> extends BaseOutputParser<Y> {
  private structuredInputParser: JsonMarkdownStructuredOutputParser<T>;

  constructor({ inputSchema }: AsymmetricStructuredOutputParserFields<T>) {
    super(...arguments);
    this.structuredInputParser = new JsonMarkdownStructuredOutputParser(
      inputSchema
    );
  }

  /**
   * Processes the parsed input into the desired output format. Must be
   * implemented by subclasses.
   * @param input The parsed input
   * @returns The processed output.
   */
  abstract outputProcessor(input: z.infer<T>): Promise<Y>;

  async parse(text: string): Promise<Y> {
    let parsedInput;
    try {
      parsedInput = await this.structuredInputParser.parse(text);
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${text}". Error: ${e}`,
        text
      );
    }

    return this.outputProcessor(parsedInput);
  }

  getFormatInstructions(): string {
    return this.structuredInputParser.getFormatInstructions();
  }
}
