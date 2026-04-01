import {
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import {
  InferInteropZodOutput,
  InteropZodType,
} from "@langchain/core/utils/types";

const THINK_OPEN_TAG = "<think>";
const THINK_CLOSE_TAG = "</think>";

const isWhitespace = (char: string): boolean =>
  char === " " || char === "\n" || char === "\r" || char === "\t";

const stripThinkTags = (text: string): string => {
  let cleanedText = "";
  let searchStart = 0;

  while (searchStart < text.length) {
    const openTagIndex = text.indexOf(THINK_OPEN_TAG, searchStart);
    if (openTagIndex === -1) {
      cleanedText += text.slice(searchStart);
      break;
    }

    cleanedText += text.slice(searchStart, openTagIndex);

    const closeTagIndex = text.indexOf(
      THINK_CLOSE_TAG,
      openTagIndex + THINK_OPEN_TAG.length
    );
    if (closeTagIndex === -1) {
      cleanedText += text.slice(openTagIndex);
      break;
    }

    searchStart = closeTagIndex + THINK_CLOSE_TAG.length;
    while (searchStart < text.length && isWhitespace(text[searchStart])) {
      searchStart += 1;
    }
  }

  return cleanedText.trim();
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
