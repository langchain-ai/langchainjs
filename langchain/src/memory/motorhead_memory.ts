import { BaseChatMemory, ChatMessageHistory } from "./chat_memory.js";
import {
  InputValues,
  OutputValues,
  MemoryVariables,
  getBufferString,
} from "./base.js";
import { fetchWithTimeout } from "../util/index.js";

export interface MotorheadMemoryMessage {
  role: string;
  content: string;
}

export interface MotorheadMemoryInput {
  chatHistory: ChatMessageHistory;
  returnMessages: boolean;
  sessionId: string;
  inputKey?: string;
  outputKey?: string;
  motorheadURL: string;
}

export class MotorheadMemory extends BaseChatMemory {
  motorheadURL = "localhost:8080";

  timeout = 3000;

  memoryKey = "history";

  sessionId: string;

  context?: string;

  constructor(fields?: Partial<MotorheadMemoryInput>) {
    super({
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey,
      chatHistory: fields?.chatHistory,
    });

    this.sessionId = fields?.sessionId ?? this.sessionId;
    this.motorheadURL = fields?.motorheadURL ?? this.motorheadURL;
  }

  async init(): Promise<void> {
    const res = await fetchWithTimeout(
      `${this.motorheadURL}/sessions/${this.sessionId}/memory`,
      {
        timeout: this.timeout,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const { messages = [], context = "NONE" } = await res.json();

    messages.forEach((message: MotorheadMemoryMessage) => {
      if (message.role === "AI") {
        this.chatHistory.addAIChatMessage(message.content);
      } else {
        this.chatHistory.addUserMessage(message.content);
      }
    });

    if (context && context !== "NONE") {
      this.context = context;
    }
  }

  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    if (this.returnMessages) {
      const result = {
        [this.memoryKey]: this.chatHistory.messages,
      };
      return result;
    }
    const result = {
      [this.memoryKey]: getBufferString(this.chatHistory.messages),
    };
    return result;
  }

  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    await fetchWithTimeout(
      `${this.motorheadURL}/sessions/${this.sessionId}/memory`,
      {
        timeout: this.timeout,
        method: "POST",
        body: JSON.stringify({
          messages: [
            { role: "Human", content: `${inputValues.input}` },
            { role: "AI", content: `${outputValues.response}` },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    await super.saveContext(inputValues, outputValues);
  }
}
