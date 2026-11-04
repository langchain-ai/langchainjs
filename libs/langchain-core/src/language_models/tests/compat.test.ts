import { describe, test, expect } from "vitest";
import { finalizeContentBlock, convertChunksToEvents } from "../compat.js";
import { AIMessageChunk } from "../../messages/ai.js";
import { ChatGenerationChunk } from "../../outputs.js";
import type { ContentBlock } from "../../messages/content/index.js";

describe("finalizeContentBlock", () => {
  test("finalizes tool_call_chunk with empty string args to tool_call with empty object", () => {
    const chunk: ContentBlock.Tools.ToolCallChunk = {
      type: "tool_call_chunk",
      id: "call_empty_string",
      name: "zero_arg_tool",
      args: "",
      index: 0,
    };

    const finalized = finalizeContentBlock(chunk);

    expect(finalized).toEqual({
      type: "tool_call",
      id: "call_empty_string",
      name: "zero_arg_tool",
      args: {},
    });
  });

  test("finalizes tool_call_chunk with undefined args to tool_call with empty object", () => {
    const chunk: ContentBlock.Tools.ToolCallChunk = {
      type: "tool_call_chunk",
      id: "call_no_args",
      name: "zero_arg_tool",
      index: 0,
    };

    const finalized = finalizeContentBlock(chunk);

    expect(finalized).toEqual({
      type: "tool_call",
      id: "call_no_args",
      name: "zero_arg_tool",
      args: {},
    });
  });

  test("finalizes tool_call_chunk with valid JSON args to tool_call with parsed args", () => {
    const chunk: ContentBlock.Tools.ToolCallChunk = {
      type: "tool_call_chunk",
      id: "call_with_args",
      name: "query_tool",
      args: '{"query":"langchain","limit":5}',
      index: 0,
    };

    const finalized = finalizeContentBlock(chunk);

    expect(finalized).toEqual({
      type: "tool_call",
      id: "call_with_args",
      name: "query_tool",
      args: { query: "langchain", limit: 5 },
    });
  });

  test("finalizes tool_call_chunk with invalid JSON to invalid_tool_call", () => {
    const chunk: ContentBlock.Tools.ToolCallChunk = {
      type: "tool_call_chunk",
      id: "call_malformed",
      name: "broken_tool",
      args: '{"broken":',
      index: 0,
    };

    const finalized = finalizeContentBlock(chunk);

    expect(finalized).toEqual({
      type: "invalid_tool_call",
      id: "call_malformed",
      name: "broken_tool",
      args: '{"broken":',
      error: "Failed to parse tool call arguments as JSON",
    });
  });

  test("returns non-tool blocks unchanged", () => {
    const textBlock: ContentBlock = {
      type: "text",
      text: "hello world",
    };

    expect(finalizeContentBlock(textBlock)).toBe(textBlock);
  });
});

describe("convertChunksToEvents with parameterless tool calls", () => {
  test("yields tool_call with empty args object when tool_call_chunk has no arguments", async () => {
    async function* generateChunks() {
      yield new ChatGenerationChunk({
        text: "",
        message: new AIMessageChunk({
          content: "",
          tool_call_chunks: [
            {
              type: "tool_call_chunk",
              name: "list_items",
              id: "tooluse_123",
              index: 0,
            },
          ],
        }),
      });
    }

    const events = [];
    for await (const event of convertChunksToEvents(generateChunks())) {
      events.push(event);
    }

    const finishEvent = events.find(
      (e) => e.event === "content-block-finish" && e.index === 0
    );
    expect(finishEvent).toBeDefined();
    expect(finishEvent?.event).toBe("content-block-finish");
    if (finishEvent?.event === "content-block-finish") {
      expect(finishEvent.content).toEqual({
        type: "tool_call",
        id: "tooluse_123",
        name: "list_items",
        args: {},
      });
    }
  });
});
