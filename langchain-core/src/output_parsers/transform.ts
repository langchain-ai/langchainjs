import { BaseOutputParser } from "./base.js";
import {
  type BaseMessage,
  isBaseMessage,
  isBaseMessageChunk,
} from "../messages/index.js";
import type { BaseCallbackConfig } from "../callbacks/manager.js";
import {
  type Generation,
  type ChatGeneration,
  GenerationChunk,
  ChatGenerationChunk,
} from "../outputs.js";
import { deepCompareStrict } from "../utils/@cfworker/json-schema/index.js";

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
