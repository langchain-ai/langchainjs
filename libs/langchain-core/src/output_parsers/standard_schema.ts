import { StandardSchemaV1 } from "@standard-schema/spec";
import { BaseOutputParser, OutputParserException } from "./base.js";
import { parseJsonMarkdown } from "./json.js";
import { BaseMessage } from "../messages/index.js";
import type { Callbacks } from "../callbacks/manager.js";
import type { ChatGeneration, Generation } from "../outputs.js";
import { throwIfRefused } from "./refusal.js";

export class StandardSchemaOutputParser<
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>,
> extends BaseOutputParser<RunOutput> {
  static lc_name() {
    return "StandardSchemaOutputParser";
  }

  lc_namespace = ["langchain", "output_parsers", "standard_schema"];

  private readonly schema: StandardSchemaV1<RunOutput>;

  constructor(schema: StandardSchemaV1<RunOutput>) {
    super();
    this.schema = schema;
  }

  static fromSerializableSchema<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(schema: StandardSchemaV1<RunOutput>) {
    return new this(schema);
  }

  /**
   * @throws {ModelRefusalError} If the model refused instead of answering.
   */
  override async parseResult(
    generations: Generation[] | ChatGeneration[],
    callbacks?: Callbacks
  ): Promise<RunOutput> {
    throwIfRefused(generations[0]);
    return super.parseResult(generations, callbacks);
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

  protected override _baseMessageToString(message: BaseMessage): string {
    return message.text;
  }

  getFormatInstructions(): string {
    return "";
  }
}
