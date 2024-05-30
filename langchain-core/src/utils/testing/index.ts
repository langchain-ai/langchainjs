/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { z } from "zod";
import {
  BaseCallbackConfig,
  CallbackManagerForLLMRun,
  CallbackManagerForToolRun,
} from "../../callbacks/manager.js";
import {
  BaseChatMessageHistory,
  BaseListChatMessageHistory,
} from "../../chat_history.js";
import { Document } from "../../documents/document.js";
import {
  BaseChatModel,
  BaseChatModelParams,
} from "../../language_models/chat_models.js";
import { BaseLLMParams, LLM } from "../../language_models/llms.js";
import {
  BaseMessage,
  AIMessage,
  AIMessageChunk,
  HumanMessage,
} from "../../messages/index.js";
import { BaseOutputParser } from "../../output_parsers/base.js";
import {
  GenerationChunk,
  type ChatResult,
  ChatGenerationChunk,
} from "../../outputs.js";
import { BaseRetriever } from "../../retrievers/index.js";
import { Runnable, RunnableLambda } from "../../runnables/base.js";
import { StructuredTool, ToolParams } from "../../tools.js";
import { BaseTracer, Run } from "../../tracers/base.js";
import { Embeddings, EmbeddingsParams } from "../../embeddings.js";
import {
  StructuredOutputMethodParams,
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "../../language_models/base.js";

/**
 * Parser for comma-separated values. It splits the input text by commas
 * and trims the resulting values.
 */
export class FakeSplitIntoListParser extends BaseOutputParser<string[]> {
  lc_namespace = ["tests", "fake"];

  getFormatInstructions() {
    return "";
  }

  async parse(text: string): Promise<string[]> {
    return text.split(",").map((value) => value.trim());
  }
}

export class FakeRunnable extends Runnable<string, Record<string, any>> {
  lc_namespace = ["tests", "fake"];

  returnOptions?: boolean;

  constructor(fields: { returnOptions?: boolean }) {
    super(fields);
    this.returnOptions = fields.returnOptions;
  }

  async invoke(
    input: string,
    options?: Partial<BaseCallbackConfig>
  ): Promise<Record<string, any>> {
    if (this.returnOptions) {
      return options ?? {};
    }
    return { input };
  }
}

export class FakeLLM extends LLM {
  response?: string;

  thrownErrorString?: string;

  constructor(
    fields: { response?: string; thrownErrorString?: string } & BaseLLMParams
  ) {
    super(fields);
    this.response = fields.response;
    this.thrownErrorString = fields.thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  async _call(
    prompt: string,
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    const response = this.response ?? prompt;
    await runManager?.handleLLMNewToken(response);
    return response;
  }
}

export class FakeStreamingLLM extends LLM {
  sleep?: number = 50;

  responses?: string[];

  thrownErrorString?: string;

  constructor(
    fields: {
      sleep?: number;
      responses?: string[];
      thrownErrorString?: string;
    } & BaseLLMParams
  ) {
    super(fields);
    this.sleep = fields.sleep ?? this.sleep;
    this.responses = fields.responses;
    this.thrownErrorString = fields.thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    const response = this.responses?.[0];
    this.responses = this.responses?.slice(1);
    return response ?? prompt;
  }

  async *_streamResponseChunks(
    input: string,
    _options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ) {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    const response = this.responses?.[0];
    this.responses = this.responses?.slice(1);
    for (const c of response ?? input) {
      await new Promise((resolve) => setTimeout(resolve, this.sleep));
      yield { text: c, generationInfo: {} } as GenerationChunk;
      await runManager?.handleLLMNewToken(c);
    }
  }
}

export class FakeChatModel extends BaseChatModel {
  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake";
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (options?.stop?.length) {
      return {
        generations: [
          {
            message: new AIMessage(options.stop[0]),
            text: options.stop[0],
          },
        ],
      };
    }
    const text = messages.map((m) => m.content).join("\n");
    await runManager?.handleLLMNewToken(text);
    return {
      generations: [
        {
          message: new AIMessage(text),
          text,
        },
      ],
      llmOutput: {},
    };
  }
}

export class FakeStreamingChatModel extends BaseChatModel {
  sleep?: number = 50;

  responses?: BaseMessage[];

  thrownErrorString?: string;

  constructor(
    fields: {
      sleep?: number;
      responses?: BaseMessage[];
      thrownErrorString?: string;
    } & BaseLLMParams
  ) {
    super(fields);
    this.sleep = fields.sleep ?? this.sleep;
    this.responses = fields.responses;
    this.thrownErrorString = fields.thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }

    const content = this.responses?.[0].content ?? messages[0].content;
    const generation: ChatResult = {
      generations: [
        {
          text: "",
          message: new AIMessage({
            content,
          }),
        },
      ],
    };

    return generation;
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    const content = this.responses?.[0].content ?? messages[0].content;
    if (typeof content !== "string") {
      for (const _ of this.responses ?? messages) {
        yield new ChatGenerationChunk({
          text: "",
          message: new AIMessageChunk({
            content,
          }),
        });
      }
    } else {
      for (const _ of this.responses ?? messages) {
        yield new ChatGenerationChunk({
          text: content,
          message: new AIMessageChunk({
            content,
          }),
        });
      }
    }
  }
}

export class FakeRetriever extends BaseRetriever {
  lc_namespace = ["test", "fake"];

  output = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
  ];

  constructor(fields?: { output: Document[] }) {
    super();
    this.output = fields?.output ?? this.output;
  }

  async _getRelevantDocuments(
    _query: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Document<Record<string, any>>[]> {
    return this.output;
  }
}

/**
 * Interface for the input parameters specific to the Fake List Chat model.
 */
export interface FakeChatInput extends BaseChatModelParams {
  /** Responses to return */
  responses: string[];

  /** Time to sleep in milliseconds between responses */
  sleep?: number;
}

/**
 * A fake Chat Model that returns a predefined list of responses. It can be used
 * for testing purposes.
 * @example
 * ```typescript
 * const chat = new FakeListChatModel({
 *   responses: ["I'll callback later.", "You 'console' them!"]
 * });
 *
 * const firstMessage = new HumanMessage("You want to hear a JavaScript joke?");
 * const secondMessage = new HumanMessage("How do you cheer up a JavaScript developer?");
 *
 * // Call the chat model with a message and log the response
 * const firstResponse = await chat.call([firstMessage]);
 * console.log({ firstResponse });
 *
 * const secondResponse = await chat.call([secondMessage]);
 * console.log({ secondResponse });
 * ```
 */
export class FakeListChatModel extends BaseChatModel {
  static lc_name() {
    return "FakeListChatModel";
  }

  responses: string[];

  i = 0;

  sleep?: number;

  constructor({ responses, sleep }: FakeChatInput) {
    super({});
    this.responses = responses;
    this.sleep = sleep;
  }

  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake-list";
  }

  async _generate(
    _messages: BaseMessage[],
    options?: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    await this._sleepIfRequested();

    if (options?.stop?.length) {
      return {
        generations: [this._formatGeneration(options.stop[0])],
      };
    } else {
      const response = this._currentResponse();
      this._incrementResponse();

      return {
        generations: [this._formatGeneration(response)],
        llmOutput: {},
      };
    }
  }

  _formatGeneration(text: string) {
    return {
      message: new AIMessage(text),
      text,
    };
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const response = this._currentResponse();
    this._incrementResponse();

    for await (const text of response) {
      await this._sleepIfRequested();
      const chunk = this._createResponseChunk(text);
      yield chunk;
      void runManager?.handleLLMNewToken(text);
    }
  }

  async _sleepIfRequested() {
    if (this.sleep !== undefined) {
      await this._sleep();
    }
  }

  async _sleep() {
    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), this.sleep);
    });
  }

  _createResponseChunk(text: string): ChatGenerationChunk {
    return new ChatGenerationChunk({
      message: new AIMessageChunk({ content: text }),
      text,
    });
  }

  _currentResponse() {
    return this.responses[this.i];
  }

  _incrementResponse() {
    if (this.i < this.responses.length - 1) {
      this.i += 1;
    } else {
      this.i = 0;
    }
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    _params:
      | StructuredOutputMethodParams<RunOutput, false>
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    _params:
      | StructuredOutputMethodParams<RunOutput, true>
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    _params:
      | StructuredOutputMethodParams<RunOutput, boolean>
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    _config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    return RunnableLambda.from(async (input) => {
      const message = await this.invoke(input);
      return JSON.parse(message.content as string);
    }) as Runnable;
  }
}

export class FakeChatMessageHistory extends BaseChatMessageHistory {
  lc_namespace = ["langchain_core", "message", "fake"];

  messages: Array<BaseMessage> = [];

  constructor() {
    super();
  }

  async getMessages(): Promise<BaseMessage[]> {
    return this.messages;
  }

  async addMessage(message: BaseMessage): Promise<void> {
    this.messages.push(message);
  }

  async addUserMessage(message: string): Promise<void> {
    this.messages.push(new HumanMessage(message));
  }

  async addAIChatMessage(message: string): Promise<void> {
    this.messages.push(new AIMessage(message));
  }

  async clear(): Promise<void> {
    this.messages = [];
  }
}

export class FakeListChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain_core", "message", "fake"];

  messages: Array<BaseMessage> = [];

  constructor() {
    super();
  }

  async addMessage(message: BaseMessage): Promise<void> {
    this.messages.push(message);
  }

  async getMessages(): Promise<BaseMessage[]> {
    return this.messages;
  }
}

export class FakeTracer extends BaseTracer {
  name = "fake_tracer";

  runs: Run[] = [];

  constructor() {
    super();
  }

  protected persistRun(run: Run): Promise<void> {
    this.runs.push(run);
    return Promise.resolve();
  }
}

export interface FakeToolParams<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends ToolParams {
  name: string;
  description: string;
  schema: T;
}

export class FakeTool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
> extends StructuredTool<T> {
  name: string;

  description: string;

  schema: T;

  constructor(fields: FakeToolParams<T>) {
    super(fields);
    this.name = fields.name;
    this.description = fields.description;
    this.schema = fields.schema;
  }

  protected async _call(
    arg: z.output<T>,
    _runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    return JSON.stringify(arg);
  }
}

/**
 * A class that provides fake embeddings by overriding the embedDocuments
 * and embedQuery methods to return fixed values.
 */
export class FakeEmbeddings extends Embeddings {
  constructor(params?: EmbeddingsParams) {
    super(params ?? {});
  }

  /**
   * Generates fixed embeddings for a list of documents.
   * @param documents List of documents to generate embeddings for.
   * @returns A promise that resolves with a list of fixed embeddings for each document.
   */
  embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.resolve(documents.map(() => [0.1, 0.2, 0.3, 0.4]));
  }

  /**
   * Generates a fixed embedding for a query.
   * @param _ The query to generate an embedding for.
   * @returns A promise that resolves with a fixed embedding for the query.
   */
  embedQuery(_: string): Promise<number[]> {
    return Promise.resolve([0.1, 0.2, 0.3, 0.4]);
  }
}

/**
 * An interface that defines additional parameters specific to the
 * SyntheticEmbeddings class.
 */
interface SyntheticEmbeddingsParams extends EmbeddingsParams {
  vectorSize: number;
}

/**
 * A class that provides synthetic embeddings by overriding the
 * embedDocuments and embedQuery methods to generate embeddings based on
 * the input documents. The embeddings are generated by converting each
 * document into chunks, calculating a numerical value for each chunk, and
 * returning an array of these values as the embedding.
 */
export class SyntheticEmbeddings
  extends Embeddings
  implements SyntheticEmbeddingsParams
{
  vectorSize: number;

  constructor(params?: SyntheticEmbeddingsParams) {
    super(params ?? {});
    this.vectorSize = params?.vectorSize ?? 4;
  }

  /**
   * Generates synthetic embeddings for a list of documents.
   * @param documents List of documents to generate embeddings for.
   * @returns A promise that resolves with a list of synthetic embeddings for each document.
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.all(documents.map((doc) => this.embedQuery(doc)));
  }

  /**
   * Generates a synthetic embedding for a document. The document is
   * converted into chunks, a numerical value is calculated for each chunk,
   * and an array of these values is returned as the embedding.
   * @param document The document to generate an embedding for.
   * @returns A promise that resolves with a synthetic embedding for the document.
   */
  async embedQuery(document: string): Promise<number[]> {
    let doc = document;

    // Only use the letters (and space) from the document, and make them lower case
    doc = doc.toLowerCase().replaceAll(/[^a-z ]/g, "");

    // Pad the document to make sure it has a divisible number of chunks
    const padMod = doc.length % this.vectorSize;
    const padGapSize = padMod === 0 ? 0 : this.vectorSize - padMod;
    const padSize = doc.length + padGapSize;
    doc = doc.padEnd(padSize, " ");

    // Break it into chunks
    const chunkSize = doc.length / this.vectorSize;
    const docChunk = [];
    for (let co = 0; co < doc.length; co += chunkSize) {
      docChunk.push(doc.slice(co, co + chunkSize));
    }

    // Turn each chunk into a number
    const ret: number[] = docChunk.map((s) => {
      let sum = 0;
      // Get a total value by adding the value of each character in the string
      for (let co = 0; co < s.length; co += 1) {
        sum += s === " " ? 0 : s.charCodeAt(co);
      }
      // Reduce this to a number between 0 and 25 inclusive
      // Then get the fractional number by dividing it by 26
      const ret = (sum % 26) / 26;
      return ret;
    });

    return ret;
  }
}

export class SingleRunExtractor extends BaseTracer {
  runPromiseResolver: (run: Run) => void;

  runPromise: Promise<Run>;

  /** The name of the callback handler. */
  name = "single_run_extractor";

  constructor() {
    super();
    this.runPromise = new Promise<Run>((extract) => {
      this.runPromiseResolver = extract;
    });
  }

  async persistRun(run: Run) {
    this.runPromiseResolver(run);
  }

  async extract(): Promise<Run> {
    return this.runPromise;
  }
}
