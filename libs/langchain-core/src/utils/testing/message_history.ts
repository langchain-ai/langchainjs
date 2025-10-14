import {
  BaseChatMessageHistory,
  BaseListChatMessageHistory,
} from "../../chat_history.js";
import { BaseMessage, AIMessage, HumanMessage } from "../../messages/index.js";
import { BaseTracer, Run } from "../../tracers/base.js";

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

  async addAIMessage(message: string): Promise<void> {
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

  async addMessage(message: BaseMessage): Promise<void> {
    this.messages.push(message);
  }

  async getMessages(): Promise<BaseMessage[]> {
    return this.messages;
  }
}

export class FakeTracer extends BaseTracer {
  name = "fake_tracer";

  runs: Run[] = [];

  constructor() {
    super();
  }

  protected persistRun(run: Run): Promise<void> {
    this.runs.push(run);
    return Promise.resolve();
  }
}
