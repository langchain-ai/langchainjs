import { Callbacks } from "../callbacks/manager.js";
import { BasePromptValue, Generation, ChatGeneration } from "./index.js";
import { Serializable } from "../load/serializable.js";

/**
 * Options for formatting instructions.
 */
export interface FormatInstructionsOptions {}

export abstract class BaseLLMOutputParser<T = unknown> extends Serializable {
  abstract parseResult(
    generations: Generation[] | ChatGeneration[],
    callbacks?: Callbacks
  ): Promise<T>;

  parseResultWithPrompt(
    generations: Generation[] | ChatGeneration[],
    _prompt: BasePromptValue,
    callbacks?: Callbacks
  ): Promise<T> {
    return this.parseResult(generations, callbacks);
  }
}

/** Class to parse the output of an LLM call.
 */
export abstract class BaseOutputParser<
  T = unknown
> extends BaseLLMOutputParser<T> {
  parseResult(
    generations: Generation[] | ChatGeneration[],
    callbacks?: Callbacks
  ): Promise<T> {
    return this.parse(generations[0].text, callbacks);
  }

  /**
   * Parse the output of an LLM call.
   *
   * @param text - LLM output to parse.
   * @returns Parsed output.
   */
  abstract parse(text: string, callbacks?: Callbacks): Promise<T>;

  async parseWithPrompt(
    text: string,
    _prompt: BasePromptValue,
    callbacks?: Callbacks
  ): Promise<T> {
    return this.parse(text, callbacks);
  }

  /**
   * Return a string describing the format of the output.
   * @returns Format instructions.
   * @param options - Options for formatting instructions.
   * @example
   * ```json
   * {
   *  "foo": "bar"
   * }
   * ```
   */
  abstract getFormatInstructions(options?: FormatInstructionsOptions): string;

  /**
   * Return the string type key uniquely identifying this class of parser
   */
  _type(): string {
    throw new Error("_type not implemented");
  }
}

export class OutputParserException extends Error {
  output?: string;

  constructor(message: string, output?: string) {
    super(message);
    this.output = output;
  }
}
