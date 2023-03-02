import { ChatMessage, Role } from "../chat_models/base.js";

export interface ChatMemoryInput {
  humanPrefix: Role;
  aiPrefix: Role;

  messages: ChatMessage[];
}

export class ChatMemory {
  humanPrefix: Role = "user";

  aiPrefix: Role = "assistant";

  messages: ChatMessage[];

  constructor(fields?: Partial<ChatMemoryInput>) {
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.messages = fields?.messages ?? [];
  }

  clear() {
    this.messages = [];
  }
}
