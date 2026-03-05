import { BaseCumulativeTransformOutputParser } from "./transform.js";
import { Operation, compare } from "../utils/json_patch.js";
import { ChatGeneration, Generation } from "../outputs.js";
import { parseJsonMarkdown, parsePartialJson } from "../utils/json.js";
import type { BaseMessage } from "../messages/index.js";

/**
 * Class for parsing the output of an LLM into a JSON object.
 */
export class JsonOutputParser<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>,
> extends BaseCumulativeTransformOutputParser<T> {
  static lc_name() {
    return "JsonOutputParser";
  }

  lc_namespace = ["langchain_core", "output_parsers"];

  lc_serializable = true;

  /** @internal */
  override _concatOutputChunks<T>(first: T, second: T): T {
    if (this.diff) {
      return super._concatOutputChunks(first, second);
    }
    return second;
  }

  protected _diff(
    prev: unknown | undefined,
    next: unknown
  ): Operation[] | undefined {
    if (!next) {
      return undefined;
    }
    if (!prev) {
      return [{ op: "replace", path: "", value: next }];
    }
    return compare(prev, next);
  }

  // This should actually return Partial<T>, but there's no way
  // to specify emitted chunks as instances separate from the main output type.
  async parsePartialResult(
    generations: ChatGeneration[] | Generation[]
  ): Promise<T | undefined> {
    return parseJsonMarkdown(generations[0].text) as T | undefined;
  }

  async parse(text: string): Promise<T> {
    return parseJsonMarkdown(text, JSON.parse) as T;
  }

  getFormatInstructions(): string {
    return "";
  }

  /**
   * Extracts text content from a message for JSON parsing.
   * Uses the message's `.text` accessor which properly handles both
   * string content and ContentBlock[] arrays (extracting text from text blocks).
   * @param message The message to extract text from
   * @returns The text content of the message
   */
  protected _baseMessageToString(message: BaseMessage): string {
    return message.text;
  }
}

export { parsePartialJson, parseJsonMarkdown };
