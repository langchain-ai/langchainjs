import { Callbacks } from "../callbacks/manager.js";
import { BasePromptValue } from "./index.js";

/**
 * Options for formatting instructions.
 */
export interface FormatInstructionsOptions {}

/** Class to parse the output of an LLM call.
 */
export abstract class BaseOutputParser<T = unknown> {
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
