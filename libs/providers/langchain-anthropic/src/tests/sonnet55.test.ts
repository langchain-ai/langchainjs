import { describe, expect, test, vi } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ChatAnthropic } from "../chat_models.js";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";
import { _makeMessageChunkFromAnthropicEvent } from "../utils/message_outputs.js";
import { validateInvocationParamCompatibility } from "../utils/params.js";

const tool = {
  name: "extract",
  input_schema: { type: "object" as const, properties: {} },
};
const model = () =>
  new ChatAnthropic({ model: "claude-sonnet-5-5", apiKey: "test" });

describe("Sonnet 5.5", () => {
  test("publishes capabilities and leaves default thinking to the provider", () => {
    const chat = model();
    expect(chat.invocationParams().thinking).toBeUndefined();
    expect(chat.profile).toMatchObject({
      maxInputTokens: 1000000,
      maxOutputTokens: 128000,
      structuredOutput: true,
      toolChoice: false,
      reasoningEffortLevels: ["low", "medium", "high", "xhigh", "max"],
      reasoningEffortDefault: "high",
    });
  });

  test.each(["any", "extract", { type: "tool" as const, name: "extract" }])(
    "rejects explicit forced choice %j",
    (tool_choice) => {
      expect(() =>
        model().invocationParams({ tools: [tool], tool_choice })
      ).toThrow("Forced tool choice");
      expect(() =>
        new ChatAnthropic({
          model: "claude-sonnet-5",
          apiKey: "test",
        }).invocationParams({ tools: [tool], tool_choice })
      ).not.toThrow();
    }
  );

  test("adds the progress-update display beta", () => {
    const chat = new ChatAnthropic({
      model: "claude-sonnet-5-5",
      apiKey: "test",
      thinking: { type: "adaptive", display: "updates" },
    });
    expect(chat.invocationParams().betas).toContain(
      "thinking-display-updates-2026-08-18"
    );
  });

  test("permits automatic tools", () => {
    expect(
      model().invocationParams({ tools: [tool], tool_choice: "auto" })
        .tool_choice
    ).toEqual({ type: "auto" });
  });

  test("does not force structured-output tools and errors if the call is missing", async () => {
    const chat = model();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const invoke = vi
      .spyOn(chat, "invoke")
      .mockResolvedValue(new AIMessageChunk({ content: "No call" }));
    try {
      await expect(
        chat.withStructuredOutput(tool).invoke("test")
      ).rejects.toThrow("jsonSchema");
      expect(invoke.mock.calls[0]?.[1]?.tool_choice).toBeUndefined();
      invoke.mockResolvedValue(
        new AIMessageChunk({
          content: [
            { type: "tool_use", id: "call", name: "extract", input: {} },
          ],
          tool_calls: [{ id: "call", name: "extract", args: {} }],
        })
      );
      await expect(
        chat.withStructuredOutput(tool).invoke("test")
      ).resolves.toEqual({});
    } finally {
      warning.mockRestore();
    }
  });

  test.each(["low", "medium", "high"] as const)(
    "supports between_tools with %s effort",
    (effort) => {
      const chat = new ChatAnthropic({
        model: "claude-sonnet-5-5",
        apiKey: "test",
        thinking: { type: "between_tools" },
        outputConfig: { effort },
      });
      expect(chat.invocationParams().thinking).toEqual({
        type: "between_tools",
      });
    }
  );

  test.each(["xhigh", "max"] as const)(
    "rejects between_tools with %s effort",
    (effort) => {
      expect(() =>
        new ChatAnthropic({
          model: "claude-sonnet-5-5",
          apiKey: "test",
          thinking: { type: "between_tools" },
          outputConfig: { effort },
        }).invocationParams()
      ).toThrow("requires outputConfig.effort");
    }
  );

  test("rejects disabled, budgets and extra between_tools fields", () => {
    for (const thinking of [
      { type: "disabled" as const },
      { type: "enabled" as const, budget_tokens: 1000 },
      { type: "between_tools" as const, display: "summarized" },
    ]) {
      expect(() =>
        validateInvocationParamCompatibility({
          model: "claude-sonnet-5-5",
          thinking,
          thinkingExplicitlySet: true,
        })
      ).toThrow();
    }
  });

  test("preserves mid-conversation system and tool changes", () => {
    const changes = [
      { type: "text", text: "New instructions" },
      { type: "tools", tools: [tool] },
    ];
    const payload = _convertMessagesToAnthropicPayload([
      new SystemMessage("Initial"),
      new HumanMessage("Hi"),
      new AIMessage("Hello"),
      new SystemMessage({ content: changes }),
      new HumanMessage("Next"),
    ]);
    expect(payload.system).toBe("Initial");
    expect(payload.messages[2]).toEqual({ role: "system", content: changes });
  });

  test.each([false, true])(
    "preserves toolset calls and matches ToolMessage results, v1=%s",
    (v1) => {
      const original = new AIMessage({
        content: [
          {
            type: "tool_use",
            id: "call",
            name: "screenshot",
            input: {},
            toolset_name: "computer",
          },
        ],
        tool_calls: [{ id: "call", name: "screenshot", args: {} }],
        response_metadata: { model_provider: "anthropic" },
      });
      const assistant = v1
        ? new AIMessage({
            content: original.contentBlocks,
            tool_calls: original.tool_calls,
            response_metadata: {
              model_provider: "anthropic",
              output_version: "v1",
            },
          })
        : original;
      const payload = _convertMessagesToAnthropicPayload([
        assistant,
        new ToolMessage({ content: "Done", tool_call_id: "call" }),
      ]);
      expect(payload.messages[0].content[0]).toMatchObject({
        type: "tool_use",
        toolset_name: "computer",
      });
      expect(payload.messages[1].content[0]).toMatchObject({
        type: "tool_result",
        toolset_name: "computer",
      });
    }
  );

  test.each([false, true])(
    "keeps signed thinking and encrypted advisor blocks with string coercion=%s",
    (coerceContentToString) => {
      for (const content_block of [
        { type: "thinking", thinking: "", signature: "signed" },
        {
          type: "advisor_redacted_result",
          data: "encrypted",
          tool_use_id: "advisor",
        },
      ]) {
        const event = {
          type: "content_block_start",
          index: 0,
          content_block,
        } as unknown as Parameters<
          typeof _makeMessageChunkFromAnthropicEvent
        >[0];
        const result = _makeMessageChunkFromAnthropicEvent(event, {
          streamUsage: true,
          coerceContentToString,
        });
        expect(result?.chunk.content).toEqual([{ index: 0, ...content_block }]);
        const payload = _convertMessagesToAnthropicPayload([result!.chunk]);
        expect(payload.messages[0].content).toEqual([content_block]);
      }
    }
  );

  test("surfaces streaming refusal details", () => {
    const stop_details = { type: "refusal", category: "bio" };
    const event = {
      type: "message_delta",
      delta: { stop_reason: "refusal", stop_sequence: null, stop_details },
      usage: { output_tokens: 1 },
    } as unknown as Parameters<typeof _makeMessageChunkFromAnthropicEvent>[0];
    const result = _makeMessageChunkFromAnthropicEvent(event, {
      streamUsage: true,
      coerceContentToString: true,
    });
    expect(result?.chunk.response_metadata.stop_details).toEqual(stop_details);
    expect(result?.chunk.additional_kwargs.stop_details).toEqual(stop_details);
  });
});
