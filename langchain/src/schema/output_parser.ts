import { BaseCallbackConfig, Callbacks } from "../callbacks/manager.js";
import {
  BasePromptValue,
  Generation,
  ChatGeneration,
  BaseMessage,
  isBaseMessage,
  isBaseMessageChunk,
  ChatGenerationChunk,
  GenerationChunk,
} from "./index.js";
import { Runnable } from "./runnable/index.js";
import { RunnableConfig } from "./runnable/config.js";
import { deepCompareStrict } from "../util/@cfworker/json-schema/index.js";

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
          this.parseResult([
            {
              message: input,
              text:
                typeof input.content === "string"
                  ? input.content
                  : JSON.stringify(input.content),
            },
          ]),
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
        yield this.parseResult([
          {
            message: chunk,
            text:
              typeof chunk.content === "string"
                ? chunk.content
                : JSON.stringify(chunk.content),
          },
        ]);
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

export type BaseCumulativeTransformOutputParserInput = { diff?: boolean };

/**
 * A base class for output parsers that can handle streaming input. It
 * extends the `BaseTransformOutputParser` class and provides a method for
 * converting parsed outputs into a diff format.
 */
export abstract class BaseCumulativeTransformOutputParser<
  T = unknown
> extends BaseTransformOutputParser<T> {
  protected diff = false;

  constructor(fields?: BaseCumulativeTransformOutputParserInput) {
    super(fields);
    this.diff = fields?.diff ?? this.diff;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract _diff(prev: any | undefined, next: any): any;

  abstract parsePartialResult(
    generations: Generation[] | ChatGeneration[]
  ): Promise<T | undefined>;

  async *_transform(
    inputGenerator: AsyncGenerator<string | BaseMessage>
  ): AsyncGenerator<T> {
    let prevParsed: T | undefined;
    let accGen: GenerationChunk | undefined;
    for await (const chunk of inputGenerator) {
      if (typeof chunk !== "string" && typeof chunk.content !== "string") {
        throw new Error("Cannot handle non-string output.");
      }
      let chunkGen: GenerationChunk;
      if (isBaseMessageChunk(chunk)) {
        if (typeof chunk.content !== "string") {
          throw new Error("Cannot handle non-string message output.");
        }
        chunkGen = new ChatGenerationChunk({
          message: chunk,
          text: chunk.content,
        });
      } else if (isBaseMessage(chunk)) {
        if (typeof chunk.content !== "string") {
          throw new Error("Cannot handle non-string message output.");
        }
        chunkGen = new ChatGenerationChunk({
          message: chunk.toChunk(),
          text: chunk.content,
        });
      } else {
        chunkGen = new GenerationChunk({ text: chunk });
      }

      if (accGen === undefined) {
        accGen = chunkGen;
      } else {
        accGen = accGen.concat(chunkGen);
      }

      const parsed = await this.parsePartialResult([accGen]);
      if (
        parsed !== undefined &&
        parsed !== null &&
        !deepCompareStrict(parsed, prevParsed)
      ) {
        if (this.diff) {
          yield this._diff(prevParsed, parsed);
        } else {
          yield parsed;
        }
        prevParsed = parsed;
      }
    }
  }
}

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
 *   new ChatOpenAI({}),
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
  }
}
