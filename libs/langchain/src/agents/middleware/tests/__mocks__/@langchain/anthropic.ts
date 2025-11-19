import { vi } from "vitest";
import { AIMessage } from "@langchain/core/messages";
class MockChatAnthropic {
  lc_kwargs: Record<string, unknown>;

  bindTools = vi.fn().mockReturnThis();
  invoke = vi
    .fn()
    .mockResolvedValue(new AIMessage({ content: "Mocked response" }));
  _streamResponseChunks = vi.fn().mockReturnThis();

  constructor(params?: Record<string, unknown>) {
    this.lc_kwargs = params || ({} as Record<string, unknown>);
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
