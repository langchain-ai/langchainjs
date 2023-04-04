import { BaseChatMemory, ChatMessageHistory } from "./chat_memory.js";
import {
  InputValues,
  OutputValues,
  MemoryVariables,
  getBufferString,
} from "./base.js";
import { fetchWithTimeout } from "../util/index.js";

const MOTORHEAD_URL = process.env.MOTORHEAD_URL || "http://localhost:8080";

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
}

export class MotorheadMemory extends BaseChatMemory {
  motorheadURL: string = MOTORHEAD_URL;

  timeout: number = 3000;

  memoryKey: string = "history";

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
  }

  async init(): Promise<void> {
    const res = await fetchWithTimeout(
      `${MOTORHEAD_URL}/sessions/${this.sessionId}/memory`,
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
      `${MOTORHEAD_URL}/sessions/${this.sessionId}/memory`,
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

    super.saveContext(inputValues, outputValues);
  }
}
