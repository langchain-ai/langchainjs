import { BaseCallbackConfig, Callbacks } from "../callbacks/manager.js";
import {
  BasePromptValue,
  Generation,
  ChatGeneration,
  BaseMessage,
} from "./index.js";
import { Runnable, RunnableConfig } from "./runnable.js";

/**
 * Options for formatting instructions.
 */
export interface FormatInstructionsOptions {}

export abstract class BaseLLMOutputParser<T = unknown> extends Runnable<
  string | BaseMessage,
  T
> {
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

  async invoke(
    input: string | BaseMessage,
    options?: RunnableConfig
  ): Promise<T> {
    if (typeof input === "string") {
      return this._callWithConfig(
        async (input: string): Promise<T> =>
          this.parseResult([{ text: input }]),
        input,
        { ...options, runType: "parser" }
      );
    } else {
      return this._callWithConfig(
        async (input: BaseMessage): Promise<T> =>
          this.parseResult([{ message: input, text: input.content }]),
        input,
        { ...options, runType: "parser" }
      );
    }
  }
}

/**
 * Class to parse the output of an LLM call.
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

/**
 * Class to parse the output of an LLM call that also allows streaming inputs.
 */
export abstract class BaseTransformOutputParser<
  T = unknown
> extends BaseOutputParser<T> {
  async *_transform(
    inputGenerator: AsyncGenerator<string | BaseMessage>
  ): AsyncGenerator<T> {
    for await (const chunk of inputGenerator) {
      if (typeof chunk === "string") {
        yield this.parseResult([{ text: chunk }]);
      } else {
        yield this.parseResult([{ message: chunk, text: chunk.content }]);
      }
    }
  }

  async *transform(
    inputGenerator: AsyncGenerator<string | BaseMessage>,
    options: BaseCallbackConfig
  ): AsyncGenerator<T> {
    yield* this._streamWithConfig(this._transform(inputGenerator), {
      ...options,
      runType: "parser",
    });
  }
}

/**
 * OutputParser that parses LLMResult into the top likely string.
 */
export class StringOutputParser extends BaseTransformOutputParser<string> {
  lc_namespace = ["schema", "output_parser"];

  lc_serializable = true;

  parse(text: string): Promise<string> {
    return Promise.resolve(text);
  }

  getFormatInstructions(): string {
    return "";
  }
}

/**
 * OutputParser that parses LLMResult into the top likely string and
 * encodes it into bytes.
 */
export class BytesOutputParser extends BaseTransformOutputParser<Uint8Array> {
  lc_namespace = ["schema", "output_parser"];

  lc_serializable = true;

  protected textEncoder = new TextEncoder();

  parse(text: string): Promise<Uint8Array> {
    return Promise.resolve(this.textEncoder.encode(text));
  }

  getFormatInstructions(): string {
    return "";
  }
}

export class OutputParserException extends Error {
  output?: string;

  constructor(message: string, output?: string) {
    super(message);
    this.output = output;
  }
}
