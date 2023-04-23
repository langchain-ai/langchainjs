import type { RedisClientType } from "redis";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";
import {
  InputValues,
  OutputValues,
  MemoryVariables,
  getBufferString,
} from "./base.js";

export interface RedisMemoryMessage {
  role: string;
  content: string;
}

export type RedisMemoryInput = BaseChatMemoryInput & {
  sessionId: string;
  memoryKey?: string;
  memoryTTL?: number;
};

export class RedisMemory extends BaseChatMemory {
  client: RedisClientType;

  memoryKey = "history";

  sessionId: string;

  memoryTTL = 300;

  constructor(client: RedisClientType, fields: RedisMemoryInput) {
    const {
      memoryKey,
      sessionId,
      memoryTTL,
      returnMessages,
      inputKey,
      outputKey,
      chatHistory,
    } = fields;
    super({ returnMessages, inputKey, outputKey, chatHistory });
    this.memoryKey = memoryKey ?? this.memoryKey;
    this.sessionId = this.memoryKey + sessionId;
    this.memoryTTL = memoryTTL ?? this.memoryTTL;
    this.client = client;
    this.client.connect().catch((err) => {
      console.log(err);
    });
  }

  async init(): Promise<void> {
    const initMessages = await this.client.lRange(this.sessionId, 0, -1);
    const orderedMessages = initMessages
      .reverse()
      .map((message) => JSON.parse(message));
    orderedMessages.forEach((message: RedisMemoryMessage) => {
      if (message.role === "AI") {
        this.chatHistory.addAIChatMessage(message.content).catch((err) => {
          console.log(err);
        });
      } else {
        this.chatHistory.addUserMessage(message.content).catch((err) => {
          console.log(err);
        });
      }
    });
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    const messages = await this.chatHistory.getMessages();
    if (this.returnMessages) {
      const result = {
        [this.memoryKey]: messages,
      };
      return result;
    }
    const result = {
      [this.memoryKey]: getBufferString(messages),
    };
    return result;
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const messagesToAdd = [
      JSON.stringify({ role: "Human", content: `${inputValues.input}` }),
      JSON.stringify({ role: "AI", content: `${outputValues.response}` }),
    ];
    await this.client.lPush(this.sessionId, messagesToAdd).catch((err) => {
      console.log(err);
    });
    await this.client.expire(this.sessionId, this.memoryTTL);
    await super.saveContext(inputValues, outputValues);
  }
}
