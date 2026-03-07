import type Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock } from "@langchain/core/messages";
import { describe, it, expect } from "vitest";
import { AnthropicMessageResponse } from "../../types.js";
import {
  _makeMessageChunkFromAnthropicEvent,
  anthropicResponseToChatMessages,
} from "../message_outputs.js";

describe("_makeMessageChunkFromAnthropicEvent", () => {
  const defaultFields = { streamUsage: false, coerceContentToString: false };

  describe("thinking content blocks", () => {
    it("converts content_block_start with thinking to reasoning", () => {
      const event = {
        type: "content_block_start" as const,
        index: 0,
        content_block: {
          type: "thinking" as const,
          thinking: "",
        },
      } as Anthropic.Beta.Messages.BetaRawMessageStreamEvent;

      const result = _makeMessageChunkFromAnthropicEvent(event, defaultFields);

      expect(result).not.toBeNull();
      const content = result!.chunk.content;
      expect(Array.isArray(content)).toBe(true);
      expect(content).toHaveLength(1);
      expect(content[0]).toMatchObject({
        index: 0,
        type: "reasoning",
        reasoning: "",
      });
    });

    it("converts thinking_delta to reasoning", () => {
      const event = {
        type: "content_block_delta" as const,
        index: 0,
        delta: {
          type: "thinking_delta" as const,
          thinking: "Let me think about this...",
        },
      } as Anthropic.Beta.Messages.BetaRawMessageStreamEvent;

      const result = _makeMessageChunkFromAnthropicEvent(event, defaultFields);

      expect(result).not.toBeNull();
      const content = result!.chunk.content;
      expect(Array.isArray(content)).toBe(true);
      expect(content[0]).toMatchObject({
        index: 0,
        type: "reasoning",
        reasoning: "Let me think about this...",
      });
    });

    it("converts signature_delta to reasoning with signature", () => {
      const event = {
        type: "content_block_delta" as const,
        index: 0,
        delta: {
          type: "signature_delta" as const,
          signature: "sig_abc123",
        },
      } as Anthropic.Beta.Messages.BetaRawMessageStreamEvent;

      const result = _makeMessageChunkFromAnthropicEvent(event, defaultFields);

      expect(result).not.toBeNull();
      const content = result!.chunk.content;
      expect(Array.isArray(content)).toBe(true);
      expect(content[0]).toMatchObject({
        index: 0,
        type: "reasoning",
        reasoning: "",
        signature: "sig_abc123",
      });
    });

    it("converts redacted_thinking to reasoning with redacted flag", () => {
      const event = {
        type: "content_block_start" as const,
        index: 0,
        content_block: {
          type: "redacted_thinking" as const,
          data: "encrypted_data",
        },
      } as Anthropic.Beta.Messages.BetaRawMessageStreamEvent;

      const result = _makeMessageChunkFromAnthropicEvent(event, defaultFields);

      expect(result).not.toBeNull();
      const content = result!.chunk.content;
      expect(Array.isArray(content)).toBe(true);
      expect(content[0]).toMatchObject({
        index: 0,
        type: "reasoning",
        reasoning: "",
        redacted: true,
      });
    });

    it("returns thinking text as string when coerceContentToString is true", () => {
      const event = {
        type: "content_block_start" as const,
        index: 0,
        content_block: {
          type: "thinking" as const,
          thinking: "Some thought",
        },
      } as Anthropic.Beta.Messages.BetaRawMessageStreamEvent;

      const result = _makeMessageChunkFromAnthropicEvent(event, {
        ...defaultFields,
        coerceContentToString: true,
      });

      expect(result).not.toBeNull();
      expect(result!.chunk.content).toBe("Some thought");
    });
  });
});

describe("anthropicResponseToChatMessages", () => {
  const baseKwargs = {
    id: "msg_123",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    usage: { input_tokens: 10, output_tokens: 20 },
  };

  it("converts thinking blocks to reasoning in non-streaming responses", () => {
    const messages = [
      {
        type: "thinking" as const,
        thinking: "Let me reason about this...",
        signature: "sig_xyz",
      },
      {
        type: "text" as const,
        text: "Here is my answer.",
      },
    ];

    const result = anthropicResponseToChatMessages(
      messages as AnthropicMessageResponse[],
      baseKwargs
    );

    expect(result).toHaveLength(1);
    const content = result[0].message.content;
    expect(Array.isArray(content)).toBe(true);
    const blocks = content as ContentBlock.Standard[];
    expect(blocks[0]).toMatchObject({
      type: "reasoning",
      reasoning: "Let me reason about this...",
      signature: "sig_xyz",
    });
    expect(blocks[1]).toMatchObject({
      type: "text",
      text: "Here is my answer.",
    });
  });

  it("converts redacted_thinking blocks to reasoning with redacted flag", () => {
    const messages = [
      {
        type: "redacted_thinking" as const,
        data: "encrypted_data",
      },
      {
        type: "text" as const,
        text: "Here is my answer.",
      },
    ] as AnthropicMessageResponse[];

    const result = anthropicResponseToChatMessages(messages, baseKwargs);

    expect(result).toHaveLength(1);
    const content = result[0].message.content;
    expect(Array.isArray(content)).toBe(true);
    const blocks = content as ContentBlock.Standard[];
    expect(blocks[0]).toMatchObject({
      type: "reasoning",
      reasoning: "",
      redacted: true,
    });
  });
});
