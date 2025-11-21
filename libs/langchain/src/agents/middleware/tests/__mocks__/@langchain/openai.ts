// eslint-disable-next-line import/no-extraneous-dependencies
import { vi } from "vitest";
import { AIMessage } from "@langchain/core/messages";

export const ChatOpenAI = class MockChatOpenAI {
  lc_kwargs: Record<string, unknown>;

  client = {
    moderations: {
      create: vi.fn(
        async (
          input: string | string[],
          params?: { model?: string; options?: unknown }
        ) => ({
          id: "moderation-mock-id",
          model: params?.model || "omni-moderation-latest",
          results: (Array.isArray(input) ? input : [input]).map(() => ({
            flagged: false,
            categories: {},
            category_scores: {},
            category_applied_input_types: {},
          })),
        })
      ),
    },
  };

  _getClientOptions = vi.fn(() => ({}));

  constructor(params?: Record<string, unknown>) {
    this.lc_kwargs = params || {};
  }

  async invoke() {
    return new AIMessage({
      content: "Emulated response for openai",
    });
  }

  getName() {
    return "ChatOpenAI";
  }

  get _modelType() {
    return "base_chat_model";
  }

  get lc_runnable() {
    return true;
  }
};
