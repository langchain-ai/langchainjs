import { Runnable } from "../runnables/index.js";
import type { RunnableConfig } from "../runnables/config.js";
import type { BasePromptValueInterface } from "../prompt_values.js";
import type { BaseMessage, MessageContentComplex } from "../messages/index.js";
import type { Callbacks } from "../callbacks/manager.js";
import type { Generation, ChatGeneration } from "../outputs.js";
import { addLangChainErrorFields } from "../errors/index.js";

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
    _prompt: BasePromptValueInterface,
    callbacks?: Callbacks
  ): Promise<T> {
    return this.parseResult(generations, callbacks);
  }

  protected _baseMessageToString(message: BaseMessage): string {
    return typeof message.content === "string"
      ? message.content
      : this._baseMessageContentToString(message.content);
  }

  protected _baseMessageContentToString(
    content: MessageContentComplex[]
  ): string {
    return JSON.stringify(content);
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
        async (input: string, options): Promise<T> =>
          this.parseResult([{ text: input }], options?.callbacks),
        input,
        { ...options, runType: "parser" }
      );
    } else {
      return this._callWithConfig(
        async (input: BaseMessage, options): Promise<T> =>
          this.parseResult(
            [
              {
                message: input,
                text: this._baseMessageToString(input),
              },
            ],
            options?.callbacks
          ),
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
    _prompt: BasePromptValueInterface,
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
 * Exception that output parsers should raise to signify a parsing error.
 *
 * This exists to differentiate parsing errors from other code or execution errors
 * that also may arise inside the output parser. OutputParserExceptions will be
 * available to catch and handle in ways to fix the parsing error, while other
 * errors will be raised.
 *
 * @param message - The error that's being re-raised or an error message.
 * @param llmOutput - String model output which is error-ing.
 * @param observation - String explanation of error which can be passed to a
 *     model to try and remediate the issue.
 * @param sendToLLM - Whether to send the observation and llm_output back to an Agent
 *     after an OutputParserException has been raised. This gives the underlying
 *     model driving the agent the context that the previous output was improperly
 *     structured, in the hopes that it will update the output to the correct
 *     format.
 */
export class OutputParserException extends Error {
  llmOutput?: string;

  observation?: string;

  sendToLLM: boolean;

  constructor(
    message: string,
    llmOutput?: string,
    observation?: string,
    sendToLLM = false
  ) {
    super(message);
    this.llmOutput = llmOutput;
    this.observation = observation;
    this.sendToLLM = sendToLLM;

    if (sendToLLM) {
      if (observation === undefined || llmOutput === undefined) {
        throw new Error(
          "Arguments 'observation' & 'llmOutput' are required if 'sendToLlm' is true"
        );
      }
    }

    addLangChainErrorFields(this, "OUTPUT_PARSING_FAILURE");
  }
}
