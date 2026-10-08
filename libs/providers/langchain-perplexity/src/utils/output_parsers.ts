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
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      cleanedText += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (text.startsWith(THINK_OPEN_TAG, index)) {
      const closeTagIndex = text.indexOf(
        THINK_CLOSE_TAG,
        index + THINK_OPEN_TAG.length
      );
      if (closeTagIndex === -1) {
        cleanedText += text.slice(index);
        break;
      }
      index = closeTagIndex + THINK_CLOSE_TAG.length - 1;
      while (index + 1 < text.length && isWhitespace(text[index + 1])) {
        index += 1;
      }
      continue;
    }

    cleanedText += char;
    inString = char === '"';
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
