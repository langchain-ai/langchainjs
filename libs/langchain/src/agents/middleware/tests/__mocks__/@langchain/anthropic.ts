import { AIMessage } from "@langchain/core/messages";

export const ChatAnthropic = class MockChatAnthropic {
  lc_kwargs: Record<string, unknown>;

  constructor(params?: Record<string, unknown>) {
    this.lc_kwargs = params || {};
  }

  async invoke() {
    return new AIMessage({
      content: "Emulated response for anthropic",
    });
  }

  getName() {
    return "ChatAnthropic";
  }

  get _modelType() {
    return "base_chat_model";
  }

  get lc_runnable() {
    return true;
  }
};
