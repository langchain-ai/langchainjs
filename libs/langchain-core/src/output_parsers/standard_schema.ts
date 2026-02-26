import { StandardSchemaV1 } from "@standard-schema/spec";
import { BaseOutputParser, OutputParserException } from "./base";
import { parseJsonMarkdown } from "./json";

export class StandardSchemaOutputParser<
  RunOutput extends Record<string, any> = Record<string, any>,
> extends BaseOutputParser<RunOutput> {
  static lc_name() {
    return "StandardSchemaOutputParser";
  }

  lc_namespace = ["langchain", "output_parsers", "standard_schema"];

  private schema: StandardSchemaV1<RunOutput>;

  constructor(schema: StandardSchemaV1<RunOutput>) {
    super();
    this.schema = schema;
  }

  static fromStandardSchema<
    RunOutput extends Record<string, any> = Record<string, any>,
  >(schema: StandardSchemaV1<RunOutput>) {
    return new this(schema);
  }

  async parse(text: string): Promise<RunOutput> {
    try {
      const json = parseJsonMarkdown(text, JSON.parse);
      const result = await this.schema["~standard"].validate(json);
      if (result.issues) {
        throw new Error(`Validation failed: ${JSON.stringify(result.issues)}`);
      }
      return result.value as RunOutput;
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${text}". Error: ${e}`,
        text
      );
    }
  }

  getFormatInstructions(): string {
    return "";
  }
}
