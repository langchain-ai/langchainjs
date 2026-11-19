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
  test("adds normalized fields and keeps the raw value", async () => {
    const msg = await new FakeInvokeModel({
      model_provider: "anthropic",
      stop_reason: "max_tokens",
    }).invoke("hi");
    expect(msg.response_metadata).toMatchObject({
      stop_reason: "max_tokens",
      finish_reason: "max_tokens",
      normalized_finish_reason: "length",
      finish_state: "complete",
    });
  });

  test("keeps an existing finish_reason and maps tool calls", async () => {
    const msg = await new FakeInvokeModel({ finish_reason: "STOP" }, [
      { name: "search", args: {}, id: "call_1", type: "tool_call" },
    ]).invoke("hi");
    expect(msg.response_metadata.finish_reason).toBe("STOP");
    expect(msg.response_metadata.normalized_finish_reason).toBe("tool_call");
  });

  test("maps OpenAI Responses status", async () => {
    const msg = await new FakeInvokeModel({
      model_provider: "openai",
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
    }).invoke("hi");
    expect(msg.response_metadata.finish_reason).toBe("incomplete");
    expect(msg.response_metadata.normalized_finish_reason).toBe("length");
  });

  test("marks pause_turn as suspended", async () => {
    const msg = await new FakeInvokeModel({
      model_provider: "anthropic",
      stop_reason: "pause_turn",
    }).invoke("hi");
    expect(msg.response_metadata.normalized_finish_reason).toBe("other");
    expect(msg.response_metadata.finish_state).toBe("suspended");
  });

  test("adds nothing without a raw value", async () => {
    const msg = await new FakeInvokeModel({
      model_provider: "anthropic",
    }).invoke("hi");
    expect(msg.response_metadata).not.toHaveProperty("finish_reason");
    expect(msg.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
    expect(msg.response_metadata).not.toHaveProperty("finish_state");
  });

  test("an OpenAI refusal normalizes to refusal", async () => {
    const msg = await new FakeInvokeModel(
      { model_provider: "openai", finish_reason: "stop" },
      [],
      { refusal: "I can't help with that." }
    ).invoke("hi");
    expect(msg.response_metadata.finish_reason).toBe("stop");
    expect(msg.response_metadata.normalized_finish_reason).toBe("refusal");
  });
});
