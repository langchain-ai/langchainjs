import { BaseTransformOutputParser } from "./transform.js";
import { ContentBlock } from "../messages/index.js";

/**
 * OutputParser that parses LLMResult into the top likely string.
 * @example
 * ```typescript
 * const promptTemplate = PromptTemplate.fromTemplate(
 *   "Tell me a joke about {topic}",
 * );
 *
 * const chain = RunnableSequence.from([
 *   promptTemplate,
 *   new ChatOpenAI({ model: "gpt-4o-mini" }),
 *   new StringOutputParser(),
 * ]);
 *
 * const result = await chain.invoke({ topic: "bears" });
 * console.log("What do you call a bear with no teeth? A gummy bear!");
 * ```
 */
export class StringOutputParser extends BaseTransformOutputParser<string> {
  static lc_name() {
    return "StrOutputParser";
  }

  lc_namespace = ["langchain_core", "output_parsers", "string"];

  lc_serializable = true;

  /**
   * Parses a string output from an LLM call. This method is meant to be
   * implemented by subclasses to define how a string output from an LLM
   * should be parsed.
   * @param text The string output from an LLM call.
   * @param callbacks Optional callbacks.
   * @returns A promise of the parsed output.
   */
  parse(text: string): Promise<string> {
    return Promise.resolve(text);
  }

  getFormatInstructions(): string {
    return "";
  }

  protected _textContentToString(content: ContentBlock.Text): string {
    return content.text;
  }

  protected _imageUrlContentToString(
    _content: ContentBlock.Data.URLContentBlock
  ): string {
    throw new Error(
      `Cannot coerce a multimodal "image_url" message part into a string.`
    );
  }

  protected _messageContentToString(content: ContentBlock): string {
    switch (content.type) {
      case "text":
      case "text_delta":
        if ("text" in content) {
          // Type guard for MessageContentText
          return this._textContentToString(content as ContentBlock.Text);
        }
        break;
      case "image_url":
        if ("image_url" in content) {
          // Type guard for MessageContentImageUrl
          return this._imageUrlContentToString(
            content as ContentBlock.Data.URLContentBlock
          );
        }
        break;
      case "reasoning":
      case "thinking":
      case "redacted_thinking":
        return "";
      default:
        throw new Error(
          `Cannot coerce "${content.type}" message part into a string.`
        );
    }
    throw new Error(`Invalid content type: ${content.type}`);
  }

  protected _baseMessageContentToString(content: ContentBlock[]): string {
    return content.reduce(
      (acc: string, item: ContentBlock) =>
        acc + this._messageContentToString(item),
      ""
    );
  }
}
