import { z } from "zod";
import { JsonMarkdownStructuredOutputParser } from "./structured.js";
import { OutputParserException } from "../schema/output_parser.js";

export type RouterOutputParserInput = {
  defaultDestination?: string;
  interpolationDepth?: number;
};

export class RouterOutputParser<
  Y extends z.ZodTypeAny
> extends JsonMarkdownStructuredOutputParser<Y> {
  defaultDestination = "DEFAULT";

  constructor(schema: Y, options?: RouterOutputParserInput) {
    super(schema);
    this.defaultDestination =
      options?.defaultDestination ?? this.defaultDestination;
  }

  async parse(text: string): Promise<z.infer<Y>> {
    try {
      const parsedText = await super.parse(text);
      if (
        parsedText.destination?.toLowerCase() ===
        this.defaultDestination.toLowerCase()
      ) {
        parsedText.destination = null;
      }

      return parsedText;
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${text}". Error: ${e}`,
        text
      );
    }
  }
}
