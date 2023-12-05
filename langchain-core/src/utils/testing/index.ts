/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BaseCallbackConfig,
  CallbackManagerForLLMRun,
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
import { LLM } from "../../language_models/llms.js";
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
import { BaseRetriever } from "../../retrievers.js";
import { Runnable } from "../../runnables/base.js";

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

  constructor(fields: { response?: string; thrownErrorString?: string }) {
    super({});
    this.response = fields.response;
    this.thrownErrorString = fields.thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    return this.response ?? prompt;
  }
}

export class FakeStreamingLLM extends LLM {
  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    return prompt;
  }

  async *_streamResponseChunks(input: string) {
    for (const c of input) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield { text: c, generationInfo: {} } as GenerationChunk;
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
    options?: this["ParsedCallOptions"]
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
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const response = this._currentResponse();
    this._incrementResponse();

    for await (const text of response) {
      await this._sleepIfRequested();
      yield this._createResponseChunk(text);
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

  public async addMessage(message: BaseMessage): Promise<void> {
    this.messages.push(message);
  }
}
