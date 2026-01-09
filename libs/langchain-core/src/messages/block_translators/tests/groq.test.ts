import { describe, expect, it } from "vitest";
import { AIMessage, AIMessageChunk } from "../../ai.js";
import { ContentBlock } from "../../content/index.js";

describe("groqTranslator", () => {
  describe("Parsed format", () => {
    it("should translate reasoning in additional_kwargs to reasoning block", () => {
      const message = new AIMessage({
        content: "The answer is 42",
        additional_kwargs: {
          reasoning: "Let me analyze this problem step by step...",
        },
        response_metadata: { model_provider: "groq" },
      });

      const expected: Array<ContentBlock.Standard> = [
        {
          type: "reasoning",
          reasoning: "Let me analyze this problem step by step...",
        },
        { type: "text", text: "The answer is 42" },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should handle empty reasoning string", () => {
      const message = new AIMessage({
        content: "Hello world",
        additional_kwargs: { reasoning: "" },
        response_metadata: { model_provider: "groq" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Hello world" },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });
  });

  describe("Raw format with <think> tags", () => {
    it("should extract reasoning from <think> tags in content", () => {
      const message = new AIMessage({
        content:
          "<think>Let me reason through this...</think>The answer is 42.",
        response_metadata: { model_provider: "groq" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "reasoning", reasoning: "Let me reason through this..." },
        { type: "text", text: "The answer is 42." },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should handle multiline thinking content", () => {
      const message = new AIMessage({
        content: `<think>
Step 1: Understand the question
Step 2: Analyze the data
Step 3: Form a conclusion
</think>Based on my analysis, the result is 100.`,
        response_metadata: { model_provider: "groq" },
      });

      const expected: Array<ContentBlock.Standard> = [
        {
          type: "reasoning",
          reasoning: `Step 1: Understand the question
Step 2: Analyze the data
Step 3: Form a conclusion`,
        },
        { type: "text", text: "Based on my analysis, the result is 100." },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should handle empty think tags", () => {
      const message = new AIMessage({
        content: "<think></think>Hello world",
        response_metadata: { model_provider: "groq" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Hello world" },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });

    it("should handle content without think tags", () => {
      const message = new AIMessage({
        content: "Hello world",
        response_metadata: { model_provider: "groq" },
      });

      const expected: Array<ContentBlock.Standard> = [
        { type: "text", text: "Hello world" },
      ];

      expect(message.contentBlocks).toEqual(expected);
    });
  });

  it("should translate reasoning with tool calls", () => {
    const message = new AIMessage({
      content: "I'll check the weather for you.",
      additional_kwargs: {
        reasoning: "The user wants weather information.",
      },
      tool_calls: [
        {
          id: "call_123",
          name: "get_weather",
          args: { location: "New York" },
        },
      ],
      response_metadata: { model_provider: "groq" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "The user wants weather information." },
      { type: "text", text: "I'll check the weather for you." },
      {
        type: "tool_call",
        id: "call_123",
        name: "get_weather",
        args: { location: "New York" },
      },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should translate AIMessageChunk with reasoning", () => {
    const chunk = new AIMessageChunk({
      content: "Processing your request...",
      additional_kwargs: { reasoning: "Analyzing input..." },
      response_metadata: { model_provider: "groq" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Analyzing input..." },
      { type: "text", text: "Processing your request..." },
    ];

    expect(chunk.contentBlocks).toEqual(expected);
  });

  it("should handle array content with think tags", () => {
    const message = new AIMessage({
      content: [
        {
          type: "text",
          text: "<think>Thinking here</think>First response part",
        },
        { type: "text", text: "Second response part" },
      ],
      response_metadata: { model_provider: "groq" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Thinking here" },
      { type: "text", text: "First response part" },
      { type: "text", text: "Second response part" },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should handle empty content with reasoning", () => {
    const message = new AIMessage({
      content: "",
      additional_kwargs: { reasoning: "Still thinking..." },
      response_metadata: { model_provider: "groq" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Still thinking..." },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });
});
