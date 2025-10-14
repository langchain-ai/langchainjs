import { describe, expect, it } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { _convertToResponsesMessageFromV1 } from "../standard.js";

describe("_convertToResponsesMessageFromV1", () => {
  it("converts text blocks into a single message with inferred role", () => {
    const message = new HumanMessage({
      contentBlocks: [
        { type: "text", text: "Hello" },
        { type: "text", text: "World" },
      ],
    });

    const result = _convertToResponsesMessageFromV1(message);

    expect(result).toEqual([
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: "Hello" },
          { type: "input_text", text: "World" },
        ],
      },
    ]);
  });

  it("emits reasoning blocks as dedicated reasoning items", () => {
    const message = new AIMessage({
      contentBlocks: [
        {
          type: "reasoning",
          id: "reason-1",
          reasoning: "Thoughts...",
        },
      ],
      response_metadata: { model_provider: "openai" },
    });

    const result = _convertToResponsesMessageFromV1(message);

    expect(result).toEqual([
      {
        type: "reasoning",
        id: "reason-1",
        summary: [{ type: "summary_text", text: "Thoughts..." }],
        content: [{ type: "reasoning_text", text: "Thoughts..." }],
      },
    ]);
  });

  it("converts tool call blocks and aggregates chunk fallbacks", () => {
    const message = new AIMessage({
      contentBlocks: [
        {
          type: "tool_call_chunk",
          id: "call-1",
          name: "calculator",
          args: '{"value":',
        },
        {
          type: "tool_call_chunk",
          id: "call-1",
          args: "42}",
        },
      ],
    });

    const result = _convertToResponsesMessageFromV1(message);

    expect(result).toEqual([
      {
        type: "function_call",
        call_id: "call-1",
        name: "calculator",
        arguments: '{"value":42}',
      },
    ]);
  });

  it("converts server tool call results to function outputs", () => {
    const message = new AIMessage({
      contentBlocks: [
        {
          type: "server_tool_call_result",
          toolCallId: "call-2",
          status: "success",
          output: { foo: "bar" },
        },
      ],
    });

    const result = _convertToResponsesMessageFromV1(message);

    expect(result).toEqual([
      {
        type: "function_call_output",
        call_id: "call-2",
        output: '{"foo":"bar"}',
        status: "completed",
      },
    ]);
  });

  it("converts completed tool calls using direct blocks", () => {
    const message = new AIMessage({
      contentBlocks: [
        {
          type: "tool_call",
          id: "call-3",
          name: "summarize",
          args: { topic: "news" },
        },
      ],
    });

    const result = _convertToResponsesMessageFromV1(message);

    expect(result).toEqual([
      {
        type: "function_call",
        call_id: "call-3",
        name: "summarize",
        arguments: '{"topic":"news"}',
      },
    ]);
  });

  it("embeds multimodal blocks alongside text", () => {
    const message = new HumanMessage({
      contentBlocks: [
        { type: "text", text: "Look at this" },
        {
          type: "image",
          url: "https://example.com/image.png",
          metadata: { detail: "high" },
        },
        {
          type: "file",
          fileId: "file-123",
          metadata: { filename: "notes.txt" },
        },
      ],
    });

    const result = _convertToResponsesMessageFromV1(message);

    expect(result).toEqual([
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: "Look at this" },
          {
            type: "input_image",
            detail: "high",
            image_url: "https://example.com/image.png",
          },
          {
            type: "input_file",
            file_id: "file-123",
            filename: "notes.txt",
          },
        ],
      },
    ]);
  });

  it("preserves OpenAI-only non_standard content when present", () => {
    const message = new AIMessage({
      contentBlocks: [
        {
          type: "non_standard",
          value: { type: "custom", payload: "data" },
        },
      ],
      response_metadata: { model_provider: "openai" },
    });

    const result = _convertToResponsesMessageFromV1(message);

    expect(result).toEqual([{ type: "custom", payload: "data" }]);
  });
});
