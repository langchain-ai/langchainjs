import {
  InputValues,
  OutputValues,
  MemoryVariables,
  getInputValue,
  getOutputValue,
} from "@langchain/core/memory";
import { getBufferString } from "@langchain/core/messages";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";

/**
 * Interface for the structure of a memory message in the Motorhead
 * service. It includes the role and content of the message.
 */
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
    url?: string;
    memoryKey?: string;
    timeout?: number;
    apiKey?: string;
    clientId?: string;
  };

const MANAGED_URL = "https://api.getmetal.io/v1/motorhead";

/**
 * Class for managing chat message memory using the Motorhead service. It
 * extends BaseChatMemory and includes methods for initializing the
 * memory, loading memory variables, and saving the context.
 */
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
    this.url = url ?? this.url;
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

  /**
   * Method that initializes the memory by fetching the session memory from
   * the Motorhead service. It adds the messages to the chat history and
   * sets the context if it is not 'NONE'.
   */
  async init(): Promise<void> {
    const res = await this.caller.call(
      fetch,
      `${this.url}/sessions/${this.sessionId}/memory`,
      {
        signal: this.timeout ? AbortSignal.timeout(this.timeout) : undefined,
        headers: this._getHeaders(),
      }
    );

    const json = await res.json();
    const data = json?.data || json; // Managed Motorhead returns { data: { messages: [], context: "NONE" } }
    const { messages = [], context = "NONE" } = data;

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

  /**
   * Method that loads the memory variables. It gets the chat messages and
   * returns them as a string or an array based on the returnMessages flag.
   * @param _values The input values.
   * @returns A promise that resolves with the memory variables.
   */
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

  /**
   * Method that saves the context to the Motorhead service and the base
   * chat memory. It sends a POST request to the Motorhead service with the
   * input and output messages, and calls the saveContext method of the base
   * chat memory.
   * @param inputValues The input values.
   * @param outputValues The output values.
   * @returns A promise that resolves when the context is saved.
   */
  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const input = getInputValue(inputValues, this.inputKey);
    const output = getOutputValue(outputValues, this.outputKey);
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
