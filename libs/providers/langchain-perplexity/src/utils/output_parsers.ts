import {
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import {
  InferInteropZodOutput,
  InteropZodType,
} from "@langchain/core/utils/types";

const stripThinkTags = (text: string): string => {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
};

/**
 * Output parser for reasoning models that strips `<think>` tags
 * before parsing structured output with a Zod schema.
 */
export class ReasoningStructuredOutputParser<
  RunOutput extends InteropZodType,
> extends StructuredOutputParser<RunOutput> {
  constructor(schema: RunOutput) {
    super(schema);
  }

  async parse(text: string): Promise<InferInteropZodOutput<RunOutput>> {
    const cleanedText = stripThinkTags(text);
    return super.parse(cleanedText);
  }
}

/**
 * Output parser for reasoning models that strips `<think>` tags
 * before parsing raw JSON output.
 */
export class ReasoningJsonOutputParser<
  RunOutput extends Record<string, unknown>,
> extends JsonOutputParser<RunOutput> {
  async parse(text: string): Promise<RunOutput> {
    const cleanedText = stripThinkTags(text);
    return super.parse(cleanedText);
  }
}
