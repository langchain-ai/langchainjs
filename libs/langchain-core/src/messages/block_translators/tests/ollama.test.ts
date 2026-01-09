import { describe, expect, it } from "vitest";
import { AIMessage, AIMessageChunk } from "../../ai.js";
import { ContentBlock } from "../../content/index.js";

describe("ollamaTranslator", () => {
  it("should translate reasoning_content in additional_kwargs to reasoning block", () => {
    const message = new AIMessage({
      content: "The answer is 42",
      additional_kwargs: {
        reasoning_content: "Let me think about this carefully...",
      },
      response_metadata: { model_provider: "ollama" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Let me think about this carefully..." },
      { type: "text", text: "The answer is 42" },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should handle messages without reasoning content", () => {
    const message = new AIMessage({
      content: "Hello world",
      response_metadata: { model_provider: "ollama" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "text", text: "Hello world" },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should handle empty reasoning content", () => {
    const message = new AIMessage({
      content: "Hello world",
      additional_kwargs: { reasoning_content: "" },
      response_metadata: { model_provider: "ollama" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "text", text: "Hello world" },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should translate reasoning with tool calls", () => {
    const message = new AIMessage({
      content: "Let me check that for you.",
      additional_kwargs: {
        reasoning_content: "The user wants to search for information.",
      },
      tool_calls: [
        {
          id: "call_123",
          name: "search",
          args: { query: "current weather" },
        },
      ],
      response_metadata: { model_provider: "ollama" },
    });

    const expected: Array<ContentBlock.Standard> = [
      {
        type: "reasoning",
        reasoning: "The user wants to search for information.",
      },
      { type: "text", text: "Let me check that for you." },
      {
        type: "tool_call",
        id: "call_123",
        name: "search",
        args: { query: "current weather" },
      },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should translate AIMessageChunk with reasoning content", () => {
    const chunk = new AIMessageChunk({
      content: "Processing...",
      additional_kwargs: { reasoning_content: "Step 1: analyze the input" },
      response_metadata: { model_provider: "ollama" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Step 1: analyze the input" },
      { type: "text", text: "Processing..." },
    ];

    expect(chunk.contentBlocks).toEqual(expected);
  });

  it("should handle array content with text blocks", () => {
    const message = new AIMessage({
      content: [
        { type: "text", text: "First part" },
        { type: "text", text: "Second part" },
      ],
      additional_kwargs: { reasoning_content: "Thinking through the problem" },
      response_metadata: { model_provider: "ollama" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Thinking through the problem" },
      { type: "text", text: "First part" },
      { type: "text", text: "Second part" },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should handle empty text content with reasoning", () => {
    const message = new AIMessage({
      content: "",
      additional_kwargs: { reasoning_content: "Still processing..." },
      response_metadata: { model_provider: "ollama" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Still processing..." },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should handle multiline reasoning content", () => {
    const message = new AIMessage({
      content: "The result is 100.",
      additional_kwargs: {
        reasoning_content: `Step 1: Read the input
Step 2: Perform calculation
Step 3: Format output`,
      },
      response_metadata: { model_provider: "ollama" },
    });

    const expected: Array<ContentBlock.Standard> = [
      {
        type: "reasoning",
        reasoning: `Step 1: Read the input
Step 2: Perform calculation
Step 3: Format output`,
      },
      { type: "text", text: "The result is 100." },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });
});
