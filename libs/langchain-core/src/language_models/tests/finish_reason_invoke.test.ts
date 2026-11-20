import { describe, test, expect } from "vitest";
import { AIMessage } from "../../messages/ai.js";
import type { BaseMessage } from "../../messages/base.js";
import type { ToolCall } from "../../messages/tool.js";
import type { ChatResult } from "../../outputs.js";
import { BaseChatModel } from "../chat_models.js";

class FakeInvokeModel extends BaseChatModel {
  constructor(
    private fakeMetadata: Record<string, unknown>,
    private toolCalls: ToolCall[] = [],
    private additionalKwargs: Record<string, unknown> = {}
  ) {
    super({});
  }

  _llmType() {
    return "fake-invoke";
  }

  async _generate(_messages: BaseMessage[]): Promise<ChatResult> {
    const message = new AIMessage({
      content: "hi",
      response_metadata: { ...this.fakeMetadata },
      additional_kwargs: { ...this.additionalKwargs },
      tool_calls: this.toolCalls,
    });
    return { generations: [{ text: "hi", message }] };
  }
}

describe("invoke finish fields", () => {
  test("keeps provider fields unchanged", async () => {
    const metadata = {
      stop_reason: "max_tokens",
      finish_reason: "max_tokens",
      normalized_finish_reason: "length",
      finish_state: "complete",
    };
    const msg = await new FakeInvokeModel(metadata).invoke("hi");
    expect(msg.response_metadata).toMatchObject(metadata);
  });

  test("adds nothing when the provider sets nothing", async () => {
    const msg = await new FakeInvokeModel({
      model_provider: "anthropic",
      stop_reason: "end_turn",
    }).invoke("hi");
    expect(msg.response_metadata).not.toHaveProperty("finish_reason");
    expect(msg.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
    expect(msg.response_metadata).not.toHaveProperty("finish_state");
  });

  test("corrects stop with tool calls", async () => {
    const msg = await new FakeInvokeModel(
      { finish_reason: "stop", normalized_finish_reason: "stop" },
      [{ name: "search", args: {}, id: "call_1", type: "tool_call" }]
    ).invoke("hi");
    expect(msg.response_metadata.finish_reason).toBe("stop");
    expect(msg.response_metadata.normalized_finish_reason).toBe("tool_call");
  });

  test("corrects a refusal", async () => {
    const msg = await new FakeInvokeModel(
      {
        model_provider: "openai",
        finish_reason: "stop",
        normalized_finish_reason: "stop",
      },
      [],
      { refusal: "I can't help with that." }
    ).invoke("hi");
    expect(msg.response_metadata.finish_reason).toBe("stop");
    expect(msg.response_metadata.normalized_finish_reason).toBe("refusal");
  });
});
