// eslint-disable-next-line import/no-extraneous-dependencies
import { vi } from "vitest";
import { AIMessage } from "@langchain/core/messages";

export const ChatOpenAI = class MockChatOpenAI {
  lc_kwargs: Record<string, unknown>;

  moderateContent = vi.fn(
    (
      input: string | string[],
      params?: { model?: string; options?: unknown }
    ) => {
      // Default: no violations
      const inputs = Array.isArray(input) ? input : [input];
      return {
        id: "moderation-mock-id",
        model: params?.model || "omni-moderation-latest",
        results: inputs.map(() => ({
          flagged: false,
          categories: {},
          category_scores: {},
          category_applied_input_types: {},
        })),
      };
    }
  );

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
