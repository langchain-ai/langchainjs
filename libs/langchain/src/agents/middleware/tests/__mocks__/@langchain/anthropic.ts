import { AIMessage } from "@langchain/core/messages";
class MockChatAnthropic {
  lc_kwargs: Record<string, unknown>;

  constructor(params?: Record<string, unknown>) {
    this.lc_kwargs = params || ({} as Record<string, unknown>);
  }

  async invoke() {
    return new AIMessage({ content: "Mocked response" });
  }

  getName() {
    return "ChatAnthropic";
  }

  get _modelType() {
    return "chat-anthropic";
  }

  get lc_runnable() {
    return true;
  }

  get model() {
    return "claude-sonnet-4-20250514";
  }
}

export const ChatAnthropic = MockChatAnthropic;
