import type Anthropic from "@anthropic-ai/sdk";
import type { Stream } from "@anthropic-ai/sdk/streaming";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ChatAnthropic, type ChatAnthropicInput } from "../chat_models.js";
import type {
  AnthropicMessageCreateParams,
  AnthropicMessageStreamEvent,
  AnthropicRequestOptions,
  AnthropicStreamingMessageCreateParams,
  Kwargs,
} from "../types.js";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";

const modelId = "claude-haiku-5-5";
const thinking = {
  type: "thinking",
  thinking: "",
  signature: "opaque-signature",
};

function makeModel(fields: Partial<ChatAnthropicInput> = {}) {
  return new ChatAnthropic({ model: modelId, apiKey: "testing", ...fields });
}

class MockHaiku extends ChatAnthropic {
  request?: (
    | AnthropicMessageCreateParams
    | AnthropicStreamingMessageCreateParams
  ) &
    Kwargs;

  responseContent: unknown[] = [thinking, { type: "text", text: "Hello" }];

  events: unknown[] = [
    {
      type: "content_block_start",
      index: 0,
      content_block: { type: "thinking", thinking: "" },
    },
    {
      type: "content_block_delta",
      index: 0,
      delta: { type: "signature_delta", signature: "opaque-signature" },
    },
    { type: "content_block_stop", index: 0 },
    {
      type: "content_block_start",
      index: 1,
      content_block: { type: "text", text: "" },
    },
    {
      type: "content_block_delta",
      index: 1,
      delta: { type: "text_delta", text: "Hello" },
    },
    { type: "content_block_stop", index: 1 },
    {
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: 3 },
    },
    { type: "message_stop" },
  ];

  constructor(fields: Partial<ChatAnthropicInput> = {}) {
    super({ model: modelId, apiKey: "testing", ...fields });
  }

  protected override async completionWithRetry(
    request: AnthropicMessageCreateParams & Kwargs,
    _options: AnthropicRequestOptions
  ): Promise<Anthropic.Message> {
    this.request = request;
    return {
      id: "msg_haiku",
      type: "message",
      role: "assistant",
      model: modelId,
      content: this.responseContent,
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 2, output_tokens: 3 },
    } as unknown as Anthropic.Message;
  }

  protected override async createStreamWithRetry(
    request: AnthropicStreamingMessageCreateParams & Kwargs,
    _options?: AnthropicRequestOptions
  ): Promise<Stream<AnthropicMessageStreamEvent>> {
    this.request = request;
    const events = this.events;
    return {
      controller: { abort() {} },
      async *[Symbol.asyncIterator]() {
        for (const event of events) yield event as AnthropicMessageStreamEvent;
      },
    } as unknown as Stream<AnthropicMessageStreamEvent>;
  }
}

describe("Claude Haiku 5.5", () => {
  test("exposes the model capabilities and token limits", () => {
    expect(makeModel().profile).toMatchObject({
      maxInputTokens: 1000000,
      maxOutputTokens: 128000,
      reasoningOutput: true,
      toolCalling: true,
      structuredOutput: true,
      imageInputs: true,
      pdfInputs: true,
    });
  });

  test.each(["low", "medium", "high", "xhigh", "max"] as const)(
    "allows default-on thinking with %s effort",
    (effort) => {
      const params = makeModel({ outputConfig: { effort } }).invocationParams();
      expect(params.model).toBe(modelId);
      expect(params.thinking).toBeUndefined();
      expect(params.output_config?.effort).toBe(effort);
    }
  );

  test.each(["xhigh", "max"] as const)(
    "rejects explicitly disabled thinking with %s effort",
    (effort) => {
      expect(() =>
        makeModel({
          thinking: { type: "disabled" },
          outputConfig: { effort },
        }).invocationParams()
      ).toThrow('thinking.type="disabled"');
    }
  );

  test("allows disabled thinking at high effort and summarized adaptive thinking", () => {
    expect(
      makeModel({
        thinking: { type: "disabled" },
        outputConfig: { effort: "high" },
      }).invocationParams().thinking
    ).toEqual({ type: "disabled" });
    const params = makeModel({
      thinking: { type: "adaptive", display: "summarized" },
    }).invocationParams();
    expect(params.thinking).toEqual({
      type: "adaptive",
      display: "summarized",
    });
  });

  test("rejects manual thinking budgets", () => {
    expect(() =>
      makeModel({
        thinking: { type: "enabled", budget_tokens: 2048 },
      }).invocationParams()
    ).toThrow('thinking.type="enabled"');
  });

  test.each([
    { temperature: 0 },
    { topP: 1 },
    { topK: 1 },
    { temperature: 1, topP: 0.99 },
  ])("rejects unsupported sampling %j", (fields) => {
    expect(() => makeModel(fields).invocationParams()).toThrow();
  });

  test.each([{ temperature: 1 }, { topP: 0.99 }])(
    "accepts and omits default sampling %j",
    (fields) => {
      const params = makeModel({
        ...fields,
        thinking: { type: "adaptive" },
      }).invocationParams();
      expect(params.temperature).toBeUndefined();
      expect(params.top_p).toBeUndefined();
    }
  );

  test("keeps forced tool choices with adaptive thinking", () => {
    const params = makeModel({
      thinking: { type: "adaptive" },
    }).invocationParams({
      tools: [{ name: "extract", input_schema: { type: "object" } }],
      tool_choice: "extract",
    });
    expect(params.tool_choice).toEqual({ type: "tool", name: "extract" });
  });

  test("forces the structured output tool with adaptive thinking", async () => {
    const model = new MockHaiku({ thinking: { type: "adaptive" } });
    model.responseContent = [
      {
        type: "tool_use",
        id: "toolu_extract",
        name: "extract",
        input: { answer: "Hello" },
      },
    ];
    const result = await model
      .withStructuredOutput(z.object({ answer: z.string() }))
      .invoke("hello");
    expect(result).toEqual({ answer: "Hello" });
    expect(model.request?.tool_choice).toEqual({
      type: "tool",
      name: "extract",
    });
  });

  test("native structured output keeps effort and parses text after opaque thinking", async () => {
    const model = new MockHaiku({ outputConfig: { effort: "low" } });
    model.responseContent = [
      thinking,
      { type: "text", text: '{"answer":"Hello"}' },
    ];
    const result = await model
      .withStructuredOutput(z.object({ answer: z.string() }), {
        method: "jsonSchema",
      })
      .invoke("hello");
    expect(result).toEqual({ answer: "Hello" });
    expect(model.request?.output_config).toMatchObject({
      effort: "low",
      format: { type: "json_schema" },
    });
  });

  test.each([false, true])(
    "invoke preserves opaque thinking with streaming=%s",
    async (streaming) => {
      const model = new MockHaiku({ streaming, outputVersion: "v0" });
      const result = await model.invoke("hello");
      expect(result.content).toEqual(
        streaming
          ? [
              { index: 0, ...thinking },
              { index: 1, type: "text", text: "Hello" },
            ]
          : model.responseContent
      );
      const payload = _convertMessagesToAnthropicPayload([
        new HumanMessage("hello"),
        result,
        new HumanMessage("continue"),
      ]);
      expect(payload.messages[1].content).toEqual([
        thinking,
        { type: "text", text: "Hello" },
      ]);
    }
  );

  test.each([thinking, { type: "redacted_thinking", data: "opaque-data" }])(
    "stream preserves %j and separate text blocks",
    async (block) => {
      const model = new MockHaiku({ outputVersion: "v0" });
      if (block.type === "redacted_thinking") {
        model.events.splice(0, 2, {
          type: "content_block_start",
          index: 0,
          content_block: block,
        });
      }
      let result: AIMessageChunk | undefined;
      for await (const chunk of await model.stream("hello"))
        result = result ? result.concat(chunk) : chunk;
      expect(result?.content).toEqual([
        { index: 0, ...block },
        { index: 1, type: "text", text: "Hello" },
      ]);
    }
  );

  test("recognizes browser and computer toolsets", () => {
    const model = makeModel();
    const tools = [
      { type: "browser_toolset_20260801" },
      { type: "computer_toolset_20260801" },
    ];
    expect(model.formatStructuredToolToAnthropic(tools)).toEqual(tools);
  });

  test.each(["v0", "v1"] as const)(
    "replays toolset namespaces and inferred tool results with %s output",
    async (outputVersion) => {
      const model = new MockHaiku({ outputVersion });
      const toolCall = {
        type: "tool_use",
        id: "toolu_click",
        name: "click",
        toolset_name: "computer",
        input: { x: 1, y: 2 },
      };
      model.responseContent = [thinking, toolCall];
      const result = await model.invoke("click");
      const payload = _convertMessagesToAnthropicPayload([
        new HumanMessage("click"),
        result,
        new ToolMessage({ content: "done", tool_call_id: "toolu_click" }),
      ]);
      expect(payload.messages[1].content).toEqual([thinking, toolCall]);
      expect(payload.messages[2].content).toEqual([
        {
          type: "tool_result",
          tool_use_id: "toolu_click",
          toolset_name: "computer",
          content: "done",
        },
      ]);
    }
  );

  test("native stream retains toolset namespaces and reports refusals", async () => {
    const model = new MockHaiku();
    model.events = [
      {
        type: "content_block_start",
        index: 0,
        content_block: {
          type: "tool_use",
          id: "toolu_click",
          name: "click",
          toolset_name: "computer",
          input: {},
        },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: '{"x":1}' },
      },
      { type: "content_block_stop", index: 0 },
      {
        type: "message_delta",
        delta: { stop_reason: "refusal", stop_sequence: null },
        usage: { output_tokens: 1 },
      },
      { type: "message_stop" },
    ];
    const events = [];
    for await (const event of model._streamChatModelEvents(
      [new HumanMessage("click")],
      {}
    ))
      events.push(event);
    expect(
      events.find((event) => event.event === "content-block-finish")
    ).toMatchObject({
      content: { type: "tool_call", toolset_name: "computer", args: { x: 1 } },
    });
    expect(
      events.find((event) => event.event === "message-finish")
    ).toMatchObject({ reason: "content_filter" });
  });

  test("replays browser tab state in tool results", () => {
    const state = {
      type: "browser_state",
      tabs: [
        {
          tab_id: "tab-1",
          title: "Example",
          url: "https://example.com",
          active: true,
        },
      ],
    };
    const result = new ToolMessage({
      content: [state],
      tool_call_id: "toolu_tabs",
    });
    const payload = _convertMessagesToAnthropicPayload([
      new AIMessage({
        content: [
          {
            type: "tool_use",
            id: "toolu_tabs",
            name: "list_tabs",
            toolset_name: "browser",
            input: {},
          },
        ],
      }),
      result,
    ]);
    expect(payload.messages[1].content).toEqual([
      {
        type: "tool_result",
        tool_use_id: "toolu_tabs",
        toolset_name: "browser",
        content: [state],
      },
    ]);
    expect(result.content).toEqual([state]);
  });

  test("replay keeps explicitly supplied toolset namespaces", () => {
    const payload = _convertMessagesToAnthropicPayload([
      new AIMessage({
        content: [
          {
            type: "tool_use",
            id: "toolu_click",
            name: "click",
            toolset_name: "computer",
            input: {},
          },
        ],
      }),
      new HumanMessage({
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_click",
            toolset_name: "other",
            content: "done",
          },
        ],
      }),
    ]);
    expect(payload.messages[1].content).toEqual([
      {
        type: "tool_result",
        tool_use_id: "toolu_click",
        toolset_name: "other",
        content: "done",
      },
    ]);
  });
});
