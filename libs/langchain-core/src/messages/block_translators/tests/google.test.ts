import { describe, expect, it } from "vitest";
import { AIMessage } from "../../ai.js";

describe("ChatGoogleTranslator", () => {
  it("should use originalTextContentBlock when content is a string", () => {
    const message = new AIMessage({
      content: "The answer is 42",
      additional_kwargs: {
        originalTextContentBlock: {
          text: "The answer is 42",
          thoughtSignature: "sig-abc",
        },
      },
      response_metadata: { model_provider: "google" },
    });

    expect(message.contentBlocks).toEqual([
      {
        type: "text",
        text: "The answer is 42",
        thoughtSignature: "sig-abc",
      },
    ]);
  });

  it("should not double-add thoughtSignature when already in content array", () => {
    const message = new AIMessage({
      content: [
        {
          type: "text",
          text: "Thinking...",
          thought: true,
        },
        {
          type: "text",
          text: "The answer is 42",
          thoughtSignature: "sig-abc",
        },
      ],
      additional_kwargs: {
        originalTextContentBlock: {
          text: "The answer is 42",
          thoughtSignature: "sig-abc",
        },
      },
      response_metadata: { model_provider: "google" },
    });

    expect(message.contentBlocks).toEqual([
      {
        type: "reasoning",
        reasoning: "Thinking...",
        thought: true,
        reasoningContentBlock: { type: "text", text: "Thinking..." },
      },
      {
        type: "text",
        text: "The answer is 42",
        thoughtSignature: "sig-abc",
      },
    ]);
  });

  it("should merge thoughtSignature from originalTextContentBlock into array content", () => {
    // This is THE BUG FIX scenario: streaming with thinking models causes
    // content to be an array, but thoughtSignature only ends up in
    // originalTextContentBlock, not in the content blocks themselves.
    const message = new AIMessage({
      content: [
        {
          type: "text",
          text: "Let me think...",
          thought: true,
        },
        {
          type: "text",
          text: "The answer is 42",
        },
      ],
      additional_kwargs: {
        originalTextContentBlock: {
          text: "The answer is 42",
          thoughtSignature: "sig-abc",
        },
      },
      response_metadata: { model_provider: "google" },
    });

    expect(message.contentBlocks).toEqual([
      {
        type: "reasoning",
        reasoning: "Let me think...",
        thought: true,
        reasoningContentBlock: { type: "text", text: "Let me think..." },
      },
      {
        type: "text",
        text: "The answer is 42",
        thoughtSignature: "sig-abc",
      },
    ]);
  });

  it("should pass through array content when no thoughtSignature exists", () => {
    const message = new AIMessage({
      content: [
        {
          type: "text",
          text: "Hello world",
        },
      ],
      response_metadata: { model_provider: "google" },
    });

    expect(message.contentBlocks).toEqual([
      { type: "text", text: "Hello world" },
    ]);
  });

  it("should handle array content with only thinking blocks (no text target)", () => {
    // Edge case: all blocks are thinking blocks, no non-thinking text block
    // to attach the signature to. Should fall through gracefully.
    const message = new AIMessage({
      content: [
        {
          type: "text",
          text: "Deep thoughts...",
          thought: true,
        },
      ],
      additional_kwargs: {
        originalTextContentBlock: {
          text: "",
          thoughtSignature: "sig-abc",
        },
      },
      response_metadata: { model_provider: "google" },
    });

    // No non-thinking text block to attach to, so thoughtSignature is not merged
    expect(message.contentBlocks).toEqual([
      {
        type: "reasoning",
        reasoning: "Deep thoughts...",
        thought: true,
        reasoningContentBlock: { type: "text", text: "Deep thoughts..." },
      },
    ]);
  });
});
