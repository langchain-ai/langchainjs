import { describe, expect, it } from "vitest";
import { AIMessage, AIMessageChunk } from "../../ai.js";
import { ContentBlock } from "../../content/index.js";

describe("openrouterTranslator", () => {
  it("should translate reasoning_content in additional_kwargs to reasoning block", () => {
    const message = new AIMessage({
      content: "The answer is 42",
      additional_kwargs: {
        reasoning_content: "Let me think about this carefully...",
      },
      response_metadata: { model_provider: "openrouter" },
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
      response_metadata: { model_provider: "openrouter" },
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
      response_metadata: { model_provider: "openrouter" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "text", text: "Hello world" },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should translate reasoning with tool calls", () => {
    const message = new AIMessage({
      content: "Let me check the weather for you.",
      additional_kwargs: {
        reasoning_content: "The user wants to know the weather in SF.",
      },
      tool_calls: [
        {
          id: "call_123",
          name: "get_weather",
          args: { location: "San Francisco" },
        },
      ],
      response_metadata: { model_provider: "openrouter" },
    });

    const expected: Array<ContentBlock.Standard> = [
      {
        type: "reasoning",
        reasoning: "The user wants to know the weather in SF.",
      },
      { type: "text", text: "Let me check the weather for you." },
      {
        type: "tool_call",
        id: "call_123",
        name: "get_weather",
        args: { location: "San Francisco" },
      },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should translate AIMessageChunk with reasoning content", () => {
    const chunk = new AIMessageChunk({
      content: "Calculating...",
      additional_kwargs: { reasoning_content: "Step 1: analyze the input" },
      response_metadata: { model_provider: "openrouter" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Step 1: analyze the input" },
      { type: "text", text: "Calculating..." },
    ];

    expect(chunk.contentBlocks).toEqual(expected);
  });

  it("should handle array content with text blocks", () => {
    const message = new AIMessage({
      content: [
        { type: "text", text: "First part" },
        { type: "text", text: "Second part" },
      ],
      additional_kwargs: { reasoning_content: "Thinking..." },
      response_metadata: { model_provider: "openrouter" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Thinking..." },
      { type: "text", text: "First part" },
      { type: "text", text: "Second part" },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should handle empty text content with reasoning", () => {
    const message = new AIMessage({
      content: "",
      additional_kwargs: { reasoning_content: "Just thinking, no output yet" },
      response_metadata: { model_provider: "openrouter" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Just thinking, no output yet" },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should translate reasoning.summary details into reasoning blocks", () => {
    const message = new AIMessage({
      content: "Done.",
      additional_kwargs: {
        reasoning_details: [
          {
            type: "reasoning.summary",
            summary: "First I considered A, then B.",
          },
        ],
      },
      response_metadata: { model_provider: "openrouter" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "First I considered A, then B." },
      { type: "text", text: "Done." },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should translate reasoning.text details into reasoning blocks", () => {
    const message = new AIMessage({
      content: "Done.",
      additional_kwargs: {
        reasoning_details: [
          {
            type: "reasoning.text",
            text: "Let me work through this step by step.",
            signature: "sig_abc",
          },
        ],
      },
      response_metadata: { model_provider: "openrouter" },
    });

    const expected: Array<ContentBlock.Standard> = [
      {
        type: "reasoning",
        reasoning: "Let me work through this step by step.",
      },
      { type: "text", text: "Done." },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should skip reasoning.encrypted details (opaque, not human-readable)", () => {
    const message = new AIMessage({
      content: "Done.",
      additional_kwargs: {
        reasoning_details: [
          {
            type: "reasoning.encrypted",
            data: "opaque-blob-from-anthropic",
          },
        ],
      },
      response_metadata: { model_provider: "openrouter" },
    });

    // Encrypted reasoning has no visible text — it only exists to be
    // round-tripped back to the provider on the next turn.
    const expected: Array<ContentBlock.Standard> = [
      { type: "text", text: "Done." },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should prefer reasoning_details when both are present", () => {
    const message = new AIMessage({
      content: "Done.",
      additional_kwargs: {
        reasoning_content: "fallback flat text",
        reasoning_details: [
          {
            type: "reasoning.summary",
            summary: "structured summary",
          },
        ],
      },
      response_metadata: { model_provider: "openrouter" },
    });

    // When both are present, reasoning_details wins (it's the richer form
    // and the one that round-trips cleanly).
    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "structured summary" },
      { type: "text", text: "Done." },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });

  it("should handle multiple reasoning.summary details as separate blocks", () => {
    const message = new AIMessage({
      content: "Done.",
      additional_kwargs: {
        reasoning_details: [
          { type: "reasoning.summary", summary: "Step 1 summary" },
          { type: "reasoning.summary", summary: "Step 2 summary" },
        ],
      },
      response_metadata: { model_provider: "openrouter" },
    });

    const expected: Array<ContentBlock.Standard> = [
      { type: "reasoning", reasoning: "Step 1 summary" },
      { type: "reasoning", reasoning: "Step 2 summary" },
      { type: "text", text: "Done." },
    ];

    expect(message.contentBlocks).toEqual(expected);
  });
});
