import { describe, expect, it } from "vitest";
import { AIMessage, AIMessageChunk } from "../../ai.js";
import { ContentBlock } from "../../content/index.js";

describe("xaiTranslator", () => {
  describe("Responses API format", () => {
    it("should translate reasoning object with summary to reasoning block", () => {
      const message = new AIMessage({
        content: "The answer is 42",
        additional_kwargs: {
          reasoning: {
            id: "reasoning_123",
            type: "reasoning",
            summary: [
              { type: "summary_text", text: "Let me think..." },
              { type: "summary_text", text: " about this." },
            ],
          },
        },
        response_metadata: { model_provider: "xai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "reasoning", reasoning: "Let me think... about this." },
        { type: "text", text: "The answer is 42" },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should handle empty summary array", () => {
      const message = new AIMessage({
        content: "Hello world",
        additional_kwargs: {
          reasoning: {
            id: "reasoning_123",
            type: "reasoning",
            summary: [],
          },
        },
        response_metadata: { model_provider: "xai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Hello world" },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });
  });

  describe("Completions API format", () => {
    it("should translate reasoning_content string to reasoning block", () => {
      const message = new AIMessage({
        content: "The answer is 42",
        additional_kwargs: {
          reasoning_content: "Let me think about this carefully...",
        },
        response_metadata: { model_provider: "xai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        {
          type: "reasoning",
          reasoning: "Let me think about this carefully...",
        },
        { type: "text", text: "The answer is 42" },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should handle empty reasoning_content", () => {
      const message = new AIMessage({
        content: "Hello world",
        additional_kwargs: { reasoning_content: "" },
        response_metadata: { model_provider: "xai" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Hello world" },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });
  });

  it("should handle messages without reasoning", () => {
    const message = new AIMessage({
      content: "Hello world",
      response_metadata: { model_provider: "xai" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "text", text: "Hello world" },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should translate reasoning with tool calls", () => {
    const message = new AIMessage({
      content: "Let me search for that.",
      additional_kwargs: {
        reasoning: {
          id: "reasoning_123",
          type: "reasoning",
          summary: [{ type: "summary_text", text: "User wants information." }],
        },
      },
      tool_calls: [
        {
          id: "call_456",
          name: "web_search",
          args: { query: "weather today" },
        },
      ],
      response_metadata: { model_provider: "xai" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "User wants information." },
      { type: "text", text: "Let me search for that." },
      {
        type: "tool_call",
        id: "call_456",
        name: "web_search",
        args: { query: "weather today" },
      },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should translate AIMessageChunk with reasoning", () => {
    const chunk = new AIMessageChunk({
      content: "Processing...",
      additional_kwargs: {
        reasoning: {
          id: "reasoning_789",
          type: "reasoning",
          summary: [{ type: "summary_text", text: "Analyzing query..." }],
        },
      },
      response_metadata: { model_provider: "xai" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Analyzing query..." },
      { type: "text", text: "Processing..." },
    ];

    expect(chunk.contentBlocks).toEqual(expected);
  });

  it("should handle array content with text blocks", () => {
    const message = new AIMessage({
      content: [
        { type: "text", text: "First response" },
        { type: "text", text: "Second response" },
      ],
      additional_kwargs: {
        reasoning_content: "Thinking about the response...",
      },
      response_metadata: { model_provider: "xai" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Thinking about the response..." },
      { type: "text", text: "First response" },
      { type: "text", text: "Second response" },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });
});
