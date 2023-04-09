import {
  HumanChatMessage,
  AIChatMessage,
  BaseChatMessage,
  BaseChatMessageHistory,
} from "../schema/index.js";
import {
  BaseMemory,
  InputValues,
  OutputValues,
  getInputValue,
} from "./base.js";

export class ChatMessageHistory extends BaseChatMessageHistory {
  messages: BaseChatMessage[] = [];

  constructor(messages?: BaseChatMessage[]) {
    super();
    this.messages = messages ?? [];
  }

  addUserMessage(message: string): void {
    this.messages.push(new HumanChatMessage(message));
  }

  addAIChatMessage(message: string): void {
    this.messages.push(new AIChatMessage(message));
  }
}

export interface BaseMemoryInput<I extends string, O extends string> {
  chatHistory: ChatMessageHistory;
  returnMessages: boolean;
  inputKey?: I;
  outputKey?: O;
}

export abstract class BaseChatMemory<
  I extends string,
  O extends string,
  MI extends string
> extends BaseMemory<I, O, MI> {
  chatHistory: ChatMessageHistory;

  returnMessages = false;

  inputKey?: I;

  outputKey?: O;

  constructor(fields?: Partial<BaseMemoryInput<I, O>>) {
    super();
    this.chatHistory = fields?.chatHistory ?? new ChatMessageHistory();
    this.returnMessages = fields?.returnMessages ?? this.returnMessages;
    this.inputKey = fields?.inputKey ?? this.inputKey;
    this.outputKey = fields?.outputKey ?? this.outputKey;
  }

  async saveContext(
    inputValues: InputValues<I>,
    outputValues: OutputValues<O>
  ): Promise<void> {
    this.chatHistory.addUserMessage(getInputValue(inputValues, this.inputKey));
    this.chatHistory.addAIChatMessage(
      getInputValue(outputValues, this.outputKey)
    );
  }
}
