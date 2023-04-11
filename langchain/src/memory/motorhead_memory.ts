import { BaseChatMemory, BaseMemoryInput } from "./chat_memory.js";
import {
  InputValues,
  OutputValues,
  MemoryVariables,
  getBufferString,
} from "./base.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

export interface MotorheadMemoryMessage {
  role: string;
  content: string;
}

export type MotorheadMemoryInput = BaseMemoryInput &
  AsyncCallerParams & {
    sessionId: string;
    motorheadURL?: string;
    memoryKey?: string;
    timeout?: number;
  };

export class MotorheadMemory extends BaseChatMemory {
  motorheadURL = "localhost:8080";

  timeout = 3000;

  memoryKey = "history";

  sessionId: string;

  context?: string;

  caller: AsyncCaller;

  constructor(fields: MotorheadMemoryInput) {
    const {
      sessionId,
      motorheadURL,
      memoryKey,
      timeout,
      returnMessages,
      inputKey,
      outputKey,
      chatHistory,
      ...rest
    } = fields;
    super({ returnMessages, inputKey, outputKey, chatHistory });

    this.caller = new AsyncCaller(rest);
    this.sessionId = sessionId;
    this.motorheadURL = motorheadURL ?? this.motorheadURL;
    this.memoryKey = memoryKey ?? this.memoryKey;
    this.timeout = timeout ?? this.timeout;
  }

  async init(): Promise<void> {
    const res = await this.caller.call(
      fetch,
      `${this.motorheadURL}/sessions/${this.sessionId}/memory`,
      {
        signal: this.timeout ? AbortSignal.timeout(this.timeout) : undefined,
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
    await Promise.all([
      this.caller.call(
        fetch,
        `${this.motorheadURL}/sessions/${this.sessionId}/memory`,
        {
          signal: this.timeout ? AbortSignal.timeout(this.timeout) : undefined,
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
      ),
      super.saveContext(inputValues, outputValues),
    ]);
  }
}
