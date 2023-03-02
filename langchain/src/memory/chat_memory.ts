import { ChatMessage, Role } from "../chat_models/base.js";
import { BaseMemory, InputValues, OutputValues } from "./base.js";

export interface ChatMemoryInput {
  humanPrefix: Role;
  aiPrefix: Role;

  messages: ChatMessage[];

  inputKey: string;
  outputKey: string;
}

export class ChatMemory extends BaseMemory implements ChatMemoryInput {
  humanPrefix: Role = "user";

  aiPrefix: Role = "assistant";

  messages: ChatMessage[];

  inputKey = "question";

  outputKey = "response";

  constructor(fields?: Partial<ChatMemoryInput>) {
    super();
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.messages = fields?.messages ?? [];
    this.inputKey = fields?.inputKey ?? this.inputKey;
    this.outputKey = fields?.outputKey ?? this.outputKey;
  }

  clear() {
    this.messages = [];
  }

  async saveContext(inputs: InputValues, outputs: Promise<OutputValues>) {
    this.messages.push(inputs[this.inputKey]);
    this.messages.push((await outputs)[this.outputKey]);
  }

  async loadMemoryVariables() {
    return this.messages;
  }
}
