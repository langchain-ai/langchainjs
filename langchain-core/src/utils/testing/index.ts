/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

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
  BaseChatModelCallOptions,
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
import { StructuredTool, ToolParams } from "../../tools/index.js";
import { ToolInputSchemaOutputType } from "../../tools/types.js";
import { BaseTracer, Run } from "../../tracers/base.js";
import {
  Embeddings,
  EmbeddingsInterface,
  EmbeddingsParams,
} from "../../embeddings.js";
import {
  StructuredOutputMethodParams,
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "../../language_models/base.js";

import { toJsonSchema } from "../json_schema.js";

import { VectorStore } from "../../vectorstores.js";
import { cosine } from "../ml-distance/similarities.js";
import { InteropZodObject, InteropZodType } from "../types/zod.js";

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
    const text = messages
      .map((m) => {
        if (typeof m.content === "string") {
          return m.content;
        }
        return JSON.stringify(m.content, null, 2);
      })
      .join("\n");
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

export class FakeStreamingChatModel extends BaseChatModel<FakeStreamingChatModelCallOptions> {
  sleep: number = 50;

  responses: BaseMessage[] = [];

  chunks: AIMessageChunk[] = [];

  toolStyle: "openai" | "anthropic" | "bedrock" | "google" = "openai";

  thrownErrorString?: string;

  private tools: (StructuredTool | ToolSpec)[] = [];

  constructor({
    sleep = 50,
    responses = [],
    chunks = [],
    toolStyle = "openai",
    thrownErrorString,
    ...rest
  }: FakeStreamingChatModelFields & BaseLLMParams) {
    super(rest);
    this.sleep = sleep;
    this.responses = responses;
    this.chunks = chunks;
    this.toolStyle = toolStyle;
    this.thrownErrorString = thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  bindTools(tools: (StructuredTool | ToolSpec)[]) {
    const merged = [...this.tools, ...tools];

    const toolDicts = merged.map((t) => {
      switch (this.toolStyle) {
        case "openai":
          return {
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: toJsonSchema(t.schema),
            },
          };
        case "anthropic":
          return {
            name: t.name,
            description: t.description,
            input_schema: toJsonSchema(t.schema),
          };
        case "bedrock":
          return {
            toolSpec: {
              name: t.name,
              description: t.description,
              inputSchema: toJsonSchema(t.schema),
            },
          };
        case "google":
          return {
            name: t.name,
            description: t.description,
            parameters: toJsonSchema(t.schema),
          };
        default:
          throw new Error(`Unsupported tool style: ${this.toolStyle}`);
      }
    });

    const wrapped =
      this.toolStyle === "google"
        ? [{ functionDeclarations: toolDicts }]
        : toolDicts;

    /* creating a *new* instance – mirrors LangChain .bind semantics for type-safety and avoiding noise */
    const next = new FakeStreamingChatModel({
      sleep: this.sleep,
      responses: this.responses,
      chunks: this.chunks,
      toolStyle: this.toolStyle,
      thrownErrorString: this.thrownErrorString,
    });
    next.tools = merged;

    return next.withConfig({ tools: wrapped } as BaseChatModelCallOptions);
  }

  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }

    const content = this.responses?.[0]?.content ?? messages[0].content ?? "";

    const generation: ChatResult = {
      generations: [
        {
          text: "",
          message: new AIMessage({
            content,
            tool_calls: this.chunks?.[0]?.tool_calls,
          }),
        },
      ],
    };

    return generation;
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    if (this.chunks?.length) {
      for (const msgChunk of this.chunks) {
        const cg = new ChatGenerationChunk({
          message: new AIMessageChunk({
            content: msgChunk.content,
            tool_calls: msgChunk.tool_calls,
            additional_kwargs: msgChunk.additional_kwargs ?? {},
          }),
          text: msgChunk.content?.toString() ?? "",
        });

        yield cg;
        await runManager?.handleLLMNewToken(
          msgChunk.content as string,
          undefined,
          undefined,
          undefined,
          undefined,
          { chunk: cg }
        );
      }
      return;
    }

    const fallback =
      this.responses?.[0] ??
      new AIMessage(
        typeof _messages[0].content === "string" ? _messages[0].content : ""
      );
    const text = typeof fallback.content === "string" ? fallback.content : "";

    for (const ch of text) {
      await new Promise((r) => setTimeout(r, this.sleep));
      const cg = new ChatGenerationChunk({
        message: new AIMessageChunk({ content: ch }),
        text: ch,
      });
      yield cg;
      await runManager?.handleLLMNewToken(
        ch,
        undefined,
        undefined,
        undefined,
        undefined,
        { chunk: cg }
      );
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
/** Minimal shape actually needed by `bindTools` */
export interface ToolSpec {
  name: string;
  description?: string;
  schema: InteropZodType | Record<string, unknown>; // Either a Zod schema *or* a plain JSON-Schema object
}
/**
 * Interface specific to the Fake Streaming Chat model.
 */
export interface FakeStreamingChatModelCallOptions
  extends BaseChatModelCallOptions {}
/**
 * Interface for the Constructor-field specific to the Fake Streaming Chat model (all optional because we fill in defaults).
 */
export interface FakeStreamingChatModelFields extends BaseChatModelParams {
  /** Milliseconds to pause between fallback char-by-char chunks */
  sleep?: number;

  /** Full AI messages to fall back to when no `chunks` supplied */
  responses?: BaseMessage[];

  /** Exact chunks to emit (can include tool-call deltas) */
  chunks?: AIMessageChunk[];

  /** How tool specs are formatted in `bindTools` */
  toolStyle?: "openai" | "anthropic" | "bedrock" | "google";

  /** Throw this error instead of streaming (useful in tests) */
  thrownErrorString?: string;
}

/**
 * Interface for the input parameters specific to the Fake List Chat model.
 */
export interface FakeChatInput extends BaseChatModelParams {
  /** Responses to return */
  responses: string[];

  /** Time to sleep in milliseconds between responses */
  sleep?: number;

  emitCustomEvent?: boolean;
}

export interface FakeListChatModelCallOptions extends BaseChatModelCallOptions {
  thrownErrorString?: string;
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
export class FakeListChatModel extends BaseChatModel<FakeListChatModelCallOptions> {
  static lc_name() {
    return "FakeListChatModel";
  }

  lc_serializable = true;

  responses: string[];

  i = 0;

  sleep?: number;

  emitCustomEvent = false;

  constructor(params: FakeChatInput) {
    super(params);
    const { responses, sleep, emitCustomEvent } = params;
    this.responses = responses;
    this.sleep = sleep;
    this.emitCustomEvent = emitCustomEvent ?? this.emitCustomEvent;
  }

  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake-list";
  }

  async _generate(
    _messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    await this._sleepIfRequested();
    if (options?.thrownErrorString) {
      throw new Error(options.thrownErrorString);
    }
    if (this.emitCustomEvent) {
      await runManager?.handleCustomEvent("some_test_event", {
        someval: true,
      });
    }

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
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const response = this._currentResponse();
    this._incrementResponse();
    if (this.emitCustomEvent) {
      await runManager?.handleCustomEvent("some_test_event", {
        someval: true,
      });
    }

    for await (const text of response) {
      await this._sleepIfRequested();
      if (options?.thrownErrorString) {
        throw new Error(options.thrownErrorString);
      }
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
      | InteropZodType<RunOutput>
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
      | InteropZodType<RunOutput>
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
      | InteropZodType<RunOutput>
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
      if (message.tool_calls?.[0]?.args) {
        return message.tool_calls[0].args as RunOutput;
      }
      if (typeof message.content === "string") {
        return JSON.parse(message.content);
      }
      throw new Error("No structured output found");
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
  T extends InteropZodObject = InteropZodObject
> extends ToolParams {
  name: string;
  description: string;
  schema: T;
}

export class FakeTool<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends InteropZodObject = InteropZodObject
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
    arg: ToolInputSchemaOutputType<T>,
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

/**
 * Interface representing a vector in memory. It includes the content
 * (text), the corresponding embedding (vector), and any associated
 * metadata.
 */
interface MemoryVector {
  content: string;
  embedding: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

/**
 * Interface for the arguments that can be passed to the
 * `FakeVectorStore` constructor. It includes an optional `similarity`
 * function.
 */
export interface FakeVectorStoreArgs {
  similarity?: typeof cosine;
}

/**
 * Class that extends `VectorStore` to store vectors in memory. Provides
 * methods for adding documents, performing similarity searches, and
 * creating instances from texts, documents, or an existing index.
 */
export class FakeVectorStore extends VectorStore {
  declare FilterType: (doc: Document) => boolean;

  memoryVectors: MemoryVector[] = [];

  similarity: typeof cosine;

  _vectorstoreType(): string {
    return "memory";
  }

  constructor(
    embeddings: EmbeddingsInterface,
    { similarity, ...rest }: FakeVectorStoreArgs = {}
  ) {
    super(embeddings, rest);

    this.similarity = similarity ?? cosine;
  }

  /**
   * Method to add documents to the memory vector store. It extracts the
   * text from each document, generates embeddings for them, and adds the
   * resulting vectors to the store.
   * @param documents Array of `Document` instances to be added to the store.
   * @returns Promise that resolves when all documents have been added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Method to add vectors to the memory vector store. It creates
   * `MemoryVector` instances for each vector and document pair and adds
   * them to the store.
   * @param vectors Array of vectors to be added to the store.
   * @param documents Array of `Document` instances corresponding to the vectors.
   * @returns Promise that resolves when all vectors have been added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const memoryVectors = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
    }));

    this.memoryVectors = this.memoryVectors.concat(memoryVectors);
  }

  /**
   * Method to perform a similarity search in the memory vector store. It
   * calculates the similarity between the query vector and each vector in
   * the store, sorts the results by similarity, and returns the top `k`
   * results along with their scores.
   * @param query Query vector to compare against the vectors in the store.
   * @param k Number of top results to return.
   * @param filter Optional filter function to apply to the vectors before performing the search.
   * @returns Promise that resolves with an array of tuples, each containing a `Document` and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    const filterFunction = (memoryVector: MemoryVector) => {
      if (!filter) {
        return true;
      }

      const doc = new Document({
        metadata: memoryVector.metadata,
        pageContent: memoryVector.content,
      });
      return filter(doc);
    };
    const filteredMemoryVectors = this.memoryVectors.filter(filterFunction);
    const searches = filteredMemoryVectors
      .map((vector, index) => ({
        similarity: this.similarity(query, vector.embedding),
        index,
      }))
      .sort((a, b) => (a.similarity > b.similarity ? -1 : 0))
      .slice(0, k);

    const result: [Document, number][] = searches.map((search) => [
      new Document({
        metadata: filteredMemoryVectors[search.index].metadata,
        pageContent: filteredMemoryVectors[search.index].content,
      }),
      search.similarity,
    ]);

    return result;
  }

  /**
   * Static method to create a `FakeVectorStore` instance from an array of
   * texts. It creates a `Document` for each text and metadata pair, and
   * adds them to the store.
   * @param texts Array of texts to be added to the store.
   * @param metadatas Array or single object of metadata corresponding to the texts.
   * @param embeddings `Embeddings` instance used to generate embeddings for the texts.
   * @param dbConfig Optional `FakeVectorStoreArgs` to configure the `FakeVectorStore` instance.
   * @returns Promise that resolves with a new `FakeVectorStore` instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig?: FakeVectorStoreArgs
  ): Promise<FakeVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return FakeVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create a `FakeVectorStore` instance from an array of
   * `Document` instances. It adds the documents to the store.
   * @param docs Array of `Document` instances to be added to the store.
   * @param embeddings `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig Optional `FakeVectorStoreArgs` to configure the `FakeVectorStore` instance.
   * @returns Promise that resolves with a new `FakeVectorStore` instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig?: FakeVectorStoreArgs
  ): Promise<FakeVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Static method to create a `FakeVectorStore` instance from an existing
   * index. It creates a new `FakeVectorStore` instance without adding any
   * documents or vectors.
   * @param embeddings `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig Optional `FakeVectorStoreArgs` to configure the `FakeVectorStore` instance.
   * @returns Promise that resolves with a new `FakeVectorStore` instance.
   */
  static async fromExistingIndex(
    embeddings: EmbeddingsInterface,
    dbConfig?: FakeVectorStoreArgs
  ): Promise<FakeVectorStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
