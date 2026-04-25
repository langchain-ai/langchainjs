import { describe, test, expect } from "vitest";
import { AIMessageChunk } from "../../messages/ai.js";
import { ChatGenerationChunk } from "../../outputs.js";
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
} from "../chat_models.js";
import type { ChatModelStreamEvent } from "../event.js";
import type { BaseMessage } from "../../messages/base.js";
import type { CallbackManagerForLLMRun } from "../../callbacks/manager.js";
import type { ChatResult } from "../../outputs.js";
import type { ContentBlock } from "../../messages/content/index.js";

/**
 * A minimal chat model that yields text chunks via _streamResponseChunks.
 * Used to test the bridge from legacy streaming to the new event protocol.
 */
class FakeTextStreamModel extends BaseChatModel {
  _llmType() {
    return "fake-text-stream";
  }

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    return { generations: [] };
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({ content: "Hello", id: "msg_test" }),
      text: "Hello",
    });
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({ content: " world" }),
      text: " world",
    });
  }
}

/**
 * A model that yields content blocks (array format) via _streamResponseChunks.
 */
class FakeBlockStreamModel extends BaseChatModel {
  _llmType() {
    return "fake-block-stream";
  }

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    return { generations: [] };
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    // Reasoning block at index 0
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: [{ type: "reasoning", reasoning: "Thinking", index: 0 }],
        id: "msg_blocks",
      }),
      text: "",
    });
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: [{ type: "reasoning", reasoning: " hard...", index: 0 }],
      }),
      text: "",
    });
    // Text block at index 1
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: [{ type: "text", text: "Result!", index: 1 }],
      }),
      text: "Result!",
    });
  }
}

class FakeThinkingStreamModel extends BaseChatModel {
  _llmType() {
    return "fake-thinking-stream";
  }

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    return { generations: [] };
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: [
          { type: "thinking", thinking: "Thinking", index: 0 },
        ] as unknown as ContentBlock[],
        id: "msg_thinking",
      }),
      text: "",
    });
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: [
          { type: "thinking", thinking: " hard...", index: 0 },
        ] as unknown as ContentBlock[],
      }),
      text: "",
    });
  }
}

/**
 * A model that yields tool call chunks via _streamResponseChunks.
 */
class FakeToolCallStreamModel extends BaseChatModel {
  _llmType() {
    return "fake-tool-stream";
  }

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    return { generations: [] };
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: "",
        id: "msg_tools",
        tool_call_chunks: [
          { id: "call_1", name: "search", args: "", index: 0 },
        ],
      }),
      text: "",
    });
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: "",
        tool_call_chunks: [{ args: '{"q":"hello"}', index: 0 }],
      }),
      text: "",
    });
  }
}

/**
 * A model that yields chunks with usage_metadata.
 */
class FakeUsageStreamModel extends BaseChatModel {
  _llmType() {
    return "fake-usage-stream";
  }

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    return { generations: [] };
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    // First chunk: input tokens known
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: "",
        id: "msg_usage",
        usage_metadata: {
          input_tokens: 100,
          output_tokens: 0,
          total_tokens: 100,
        },
      }),
      text: "",
    });
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({ content: "Hi" }),
      text: "Hi",
    });
    // Last chunk: output tokens known
    yield new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: "",
        usage_metadata: {
          input_tokens: 0,
          output_tokens: 5,
          total_tokens: 5,
        },
      }),
      text: "",
    });
  }
}

describe("_streamChatModelEvents bridge", () => {
  describe("text streaming", () => {
    test("bridges string content to text content block events", async () => {
      const model = new FakeTextStreamModel({});
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      // message-start
      expect(events[0]!.event).toBe("message-start");
      expect((events[0] as { id?: string }).id).toBe("msg_test");

      // content-block-start for text
      expect(events[1]!.event).toBe("content-block-start");
      const startBlock = events[1] as {
        index: number;
        content: ContentBlock;
      };
      expect(startBlock.index).toBe(0);
      expect(startBlock.content.type).toBe("text");

      // content-block-delta for "Hello"
      expect(events[2]!.event).toBe("content-block-delta");
      const delta1 = events[2] as {
        index: number;
        content: { type: string; text?: string };
      };
      expect(delta1.content.type).toBe("text");
      expect(delta1.content.text).toBe("Hello");

      // content-block-delta for " world"
      expect(events[3]!.event).toBe("content-block-delta");
      const delta2 = events[3] as {
        index: number;
        content: { type: string; text?: string };
      };
      expect(delta2.content.type).toBe("text");
      expect(delta2.content.text).toBe(" world");

      // content-block-finish
      const finishIdx = events.findIndex(
        (e) => e.event === "content-block-finish"
      );
      expect(finishIdx).toBeGreaterThan(-1);
      const finish = events[finishIdx] as {
        content: ContentBlock.Standard;
      };
      expect((finish.content as ContentBlock.Text).text).toBe("Hello world");

      // message-finish
      const msgFinish = events[events.length - 1]!;
      expect(msgFinish.event).toBe("message-finish");
      expect((msgFinish as { reason: string }).reason).toBe("stop");
    });
  });

  describe("block content streaming", () => {
    test("bridges array content blocks with proper indexing", async () => {
      const model = new FakeBlockStreamModel({});
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      // Should have start events for both blocks
      const starts = events.filter((e) => e.event === "content-block-start");
      expect(starts.length).toBe(2);

      // Block 0: reasoning
      const reasoningStart = starts.find(
        (e) => (e as { index: number }).index === 0
      ) as { content: ContentBlock };
      expect(reasoningStart!.content.type).toBe("reasoning");

      // Block 1: text
      const textStart = starts.find(
        (e) => (e as { index: number }).index === 1
      ) as { content: ContentBlock };
      expect(textStart!.content.type).toBe("text");

      // Reasoning deltas should accumulate
      const reasoningDeltas = events.filter(
        (e) =>
          e.event === "content-block-delta" &&
          (e as { index: number }).index === 0
      );
      expect(reasoningDeltas.length).toBe(1); // second reasoning chunk is a delta

      // Check reasoning delta
      const lastReasoningDelta = reasoningDeltas[
        reasoningDeltas.length - 1
      ] as {
        content: { type: string; reasoning?: string };
      };
      expect(lastReasoningDelta.content.type).toBe("reasoning");
      expect(lastReasoningDelta.content.reasoning).toBe(" hard...");

      // Finish events for both blocks
      const finishes = events.filter((e) => e.event === "content-block-finish");
      expect(finishes.length).toBe(2);
    });

    test("accumulates provider thinking blocks", async () => {
      const model = new FakeThinkingStreamModel({});
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const finish = events.find(
        (e) =>
          e.event === "content-block-finish" &&
          (e as { index: number }).index === 0
      ) as { content: { type: string; thinking?: string } };

      expect(finish.content.type).toBe("thinking");
      expect(finish.content.thinking).toBe("Thinking hard...");
    });
  });

  describe("tool call streaming", () => {
    test("bridges tool_call_chunks to content block events", async () => {
      const model = new FakeToolCallStreamModel({});
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      // Should have a start event for the tool call
      const starts = events.filter((e) => e.event === "content-block-start");
      expect(starts.length).toBeGreaterThanOrEqual(1);

      const toolStart = starts.find(
        (e) =>
          (e as { content: ContentBlock }).content.type === "tool_call_chunk"
      ) as { content: ContentBlock.Tools.ToolCallChunk } | undefined;
      expect(toolStart).toBeDefined();
      expect(toolStart!.content.name).toBe("search");

      // Should have a finish event with finalized tool call
      const finishes = events.filter((e) => e.event === "content-block-finish");
      const toolFinish = finishes.find(
        (e) =>
          (e as { content: ContentBlock.Standard }).content.type === "tool_call"
      ) as { content: ContentBlock.Tools.ToolCall } | undefined;
      expect(toolFinish).toBeDefined();
      expect(toolFinish!.content.name).toBe("search");
      expect(toolFinish!.content.args).toEqual({ q: "hello" });
    });
  });

  describe("usage streaming", () => {
    test("emits usage events when usage_metadata changes", async () => {
      const model = new FakeUsageStreamModel({});
      const events: ChatModelStreamEvent[] = [];
      for await (const event of model._streamChatModelEvents(
        [],
        {} as BaseChatModelCallOptions
      )) {
        events.push(event);
      }

      const usageEvents = events.filter((e) => e.event === "usage");
      expect(usageEvents.length).toBeGreaterThanOrEqual(1);

      // First usage: input tokens
      const firstUsage = usageEvents[0] as { usage: { input_tokens: number } };
      expect(firstUsage.usage.input_tokens).toBe(100);

      // message-start should also have usage
      const msgStart = events[0] as {
        event: string;
        usage?: { input_tokens: number };
      };
      expect(msgStart.event).toBe("message-start");
      expect(msgStart.usage?.input_tokens).toBe(100);
    });
  });

  describe("streamV2 method", () => {
    test("returns ChatModelStream from streamV2()", async () => {
      const model = new FakeTextStreamModel({});
      const stream = model.streamV2("Hello");

      // Should be iterable
      const events: ChatModelStreamEvent[] = [];
      for await (const event of stream) {
        events.push(event);
      }
      expect(events.length).toBeGreaterThan(0);
    });

    test("text sub-stream works via streamV2()", async () => {
      const model = new FakeTextStreamModel({});
      const stream = model.streamV2("Hello");

      const text = await stream.text;
      expect(text).toBe("Hello world");
    });

    test("output works via streamV2()", async () => {
      const model = new FakeTextStreamModel({});
      const stream = model.streamV2("Hello");

      const message = await stream.output;
      expect(message._getType()).toBe("ai");

      const content = message.content as Array<{ type: string; text?: string }>;
      expect(content.length).toBe(1);
      expect(content[0]!.text).toBe("Hello world");
    });

    test("await stream returns AIMessage", async () => {
      const model = new FakeTextStreamModel({});
      const message = await model.streamV2("Hello");

      expect(message._getType()).toBe("ai");
      expect(message.id).toBe("msg_test");
    });
  });
});
