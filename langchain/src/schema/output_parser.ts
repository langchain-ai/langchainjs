import { BaseCallbackConfig, Callbacks } from "../callbacks/manager.js";
import {
  BasePromptValue,
  Generation,
  ChatGeneration,
  BaseMessage,
} from "./index.js";
import { Runnable } from "./runnable/index.js";
import { RunnableConfig } from "./runnable/config.js";

/**
 * Options for formatting instructions.
 */
export interface FormatInstructionsOptions {}

/**
 * Abstract base class for parsing the output of a Large Language Model
 * (LLM) call. It provides methods for parsing the result of an LLM call
 * and invoking the parser with a given input.
 */
export abstract class BaseLLMOutputParser<T = unknown> extends Runnable<
  string | BaseMessage,
  T
> {
  /**
   * Parses the result of an LLM call. This method is meant to be
   * implemented by subclasses to define how the output from the LLM should
   * be parsed.
   * @param generations The generations from an LLM call.
   * @param callbacks Optional callbacks.
   * @returns A promise of the parsed output.
   */
  abstract parseResult(
    generations: Generation[] | ChatGeneration[],
    callbacks?: Callbacks
  ): Promise<T>;

  /**
   * Parses the result of an LLM call with a given prompt. By default, it
   * simply calls `parseResult`.
   * @param generations The generations from an LLM call.
   * @param _prompt The prompt used in the LLM call.
   * @param callbacks Optional callbacks.
   * @returns A promise of the parsed output.
   */
  parseResultWithPrompt(
    generations: Generation[] | ChatGeneration[],
    _prompt: BasePromptValue,
    callbacks?: Callbacks
  ): Promise<T> {
    return this.parseResult(generations, callbacks);
  }

  /**
   * Calls the parser with a given input and optional configuration options.
   * If the input is a string, it creates a generation with the input as
   * text and calls `parseResult`. If the input is a `BaseMessage`, it
   * creates a generation with the input as a message and the content of the
   * input as text, and then calls `parseResult`.
   * @param input The input to the parser, which can be a string or a `BaseMessage`.
   * @param options Optional configuration options.
   * @returns A promise of the parsed output.
   */
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

  /**
   * Transforms an asynchronous generator of input into an asynchronous
   * generator of parsed output.
   * @param inputGenerator An asynchronous generator of input.
   * @param options A configuration object.
   * @returns An asynchronous generator of parsed output.
   */
  async *transform(
    inputGenerator: AsyncGenerator<string | BaseMessage>,
    options: BaseCallbackConfig
  ): AsyncGenerator<T> {
    yield* this._transformStreamWithConfig(
      inputGenerator,
      this._transform.bind(this),
      {
        ...options,
        runType: "parser",
      }
    );
  }
}

/**
 * OutputParser that parses LLMResult into the top likely string.
 */
export class StringOutputParser extends BaseTransformOutputParser<string> {
  static lc_name() {
    return "StrOutputParser";
  }

  lc_namespace = ["langchain", "schema", "output_parser"];

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
}

/**
 * OutputParser that parses LLMResult into the top likely string and
 * encodes it into bytes.
 */
export class BytesOutputParser extends BaseTransformOutputParser<Uint8Array> {
  static lc_name() {
    return "BytesOutputParser";
  }

  lc_namespace = ["langchain", "schema", "output_parser"];

  lc_serializable = true;

  protected textEncoder = new TextEncoder();

  parse(text: string): Promise<Uint8Array> {
    return Promise.resolve(this.textEncoder.encode(text));
  }

  getFormatInstructions(): string {
    return "";
  }
}

/**
 * Exception that output parsers should raise to signify a parsing error.
 *
 * This exists to differentiate parsing errors from other code or execution errors
 * that also may arise inside the output parser. OutputParserExceptions will be
 * available to catch and handle in ways to fix the parsing error, while other
 * errors will be raised.
 *
 * Args:
 *     message: The error that's being re-raised or an error message.
 *     observation: String explanation of error which can be passed to a
 *         model to try and remediate the issue.
 *     output: String model output which is error-ing.
 *     sendToLLM: Whether to send the observation and llm_output back to an Agent
 *         after an OutputParserException has been raised. This gives the underlying
 *         model driving the agent the context that the previous output was improperly
 *         structured, in the hopes that it will update the output to the correct
 *         format.
 */
export class OutputParserException extends Error {
  observation?: string;

  output?: string;

  sendToLLM: boolean;

  constructor(message: string, output?: string, sendToLLM = false) {
    super(message);
    this.output = output;
    this.sendToLLM = sendToLLM;
  }
}
