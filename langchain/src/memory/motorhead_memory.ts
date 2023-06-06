import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";
import {
  InputValues,
  OutputValues,
  MemoryVariables,
  getBufferString,
  getInputValue,
} from "./base.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

export interface MotorheadMemoryMessage {
  role: string;
  content: string;
}

/**
 * @interface
 */
export type MotorheadMemoryInput = BaseChatMemoryInput &
  AsyncCallerParams & {
    sessionId: string;
    /** @deprecated Use "url" instead. */
    motorheadURL?: string;
    url?: string;
    memoryKey?: string;
    timeout?: number;
    apiKey?: string;
    clientId?: string;
  };

const MANAGED_URL = "https://api.getmetal.io/v1/motorhead";

export class MotorheadMemory extends BaseChatMemory {
  url = MANAGED_URL;

  timeout = 3000;

  memoryKey = "history";

  sessionId: string;

  context?: string;

  caller: AsyncCaller;

  // Managed Params
  apiKey?: string;

  clientId?: string;

  constructor(fields: MotorheadMemoryInput) {
    const {
      sessionId,
      url,
      motorheadURL,
      memoryKey,
      timeout,
      returnMessages,
      inputKey,
      outputKey,
      chatHistory,
      apiKey,
      clientId,
      ...rest
    } = fields;
    super({ returnMessages, inputKey, outputKey, chatHistory });

    this.caller = new AsyncCaller(rest);
    this.sessionId = sessionId;
    this.url = url ?? motorheadURL ?? this.url;
    this.memoryKey = memoryKey ?? this.memoryKey;
    this.timeout = timeout ?? this.timeout;
    this.apiKey = apiKey;
    this.clientId = clientId;
  }

  get memoryKeys() {
    return [this.memoryKey];
  }

  _getHeaders(): HeadersInit {
    const isManaged = this.url === MANAGED_URL;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (isManaged && !(this.apiKey && this.clientId)) {
      throw new Error(
        "apiKey and clientId are required for managed motorhead. Visit https://getmetal.io to get your keys."
      );
    }

    if (isManaged && this.apiKey && this.clientId) {
      headers["x-metal-api-key"] = this.apiKey;
      headers["x-metal-client-id"] = this.clientId;
    }
    return headers;
  }

  async init(): Promise<void> {
    const res = await this.caller.call(
      fetch,
      `${this.url}/sessions/${this.sessionId}/memory`,
      {
        signal: this.timeout ? AbortSignal.timeout(this.timeout) : undefined,
        headers: this._getHeaders(),
      }
    );

    const { messages = [], context = "NONE" } = await res.json();

    await Promise.all(
      messages.reverse().map(async (message: MotorheadMemoryMessage) => {
        if (message.role === "AI") {
          await this.chatHistory.addAIChatMessage(message.content);
        } else {
          await this.chatHistory.addUserMessage(message.content);
        }
      })
    );

    if (context && context !== "NONE") {
      this.context = context;
    }
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
    const input = getInputValue(inputValues, this.inputKey);
    const output = getInputValue(outputValues, this.outputKey);
    await Promise.all([
      this.caller.call(fetch, `${this.url}/sessions/${this.sessionId}/memory`, {
        signal: this.timeout ? AbortSignal.timeout(this.timeout) : undefined,
        method: "POST",
        body: JSON.stringify({
          messages: [
            { role: "Human", content: `${input}` },
            { role: "AI", content: `${output}` },
          ],
        }),
        headers: this._getHeaders(),
      }),
      super.saveContext(inputValues, outputValues),
    ]);
  }
}
