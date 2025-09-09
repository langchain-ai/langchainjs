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

export class ReasoningStructuredOutputParser<
  RunOutput extends InteropZodType
> extends StructuredOutputParser<RunOutput> {
  constructor(schema: RunOutput) {
    super(schema);
  }

  async parse(text: string): Promise<InferInteropZodOutput<RunOutput>> {
    const cleanedText = stripThinkTags(text);
    return super.parse(cleanedText);
  }
}

export class ReasoningJsonOutputParser<
  RunOutput extends Record<string, unknown>
> extends JsonOutputParser<RunOutput> {
  async parse(text: string): Promise<RunOutput> {
    const cleanedText = stripThinkTags(text);
    return super.parse(cleanedText);
  }
}
