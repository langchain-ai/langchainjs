import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import type { BaseMessage, ContentBlock } from "@langchain/core/messages";
import { _formatStandardContent } from "../utils/standard.js";

function createAnthropicMessage(blocks: ContentBlock.Standard[]): BaseMessage {
  return {
    content: "",
    contentBlocks: blocks,
    response_metadata: { model_provider: "anthropic" },
  } as unknown as BaseMessage;
}

describe("_formatStandardContent", () => {
  it("converts file blocks backed by file IDs into Anthropic documents", () => {
    const fileBlock: ContentBlock.Multimodal.File = {
      type: "file",
      fileId: "file-123",
      metadata: {
        cache_control: { type: "ephemeral", ttl: "5m" },
        citations: { enabled: true },
        context: "source context",
        title: "My Document",
      },
    };

    const [content] = _formatStandardContent(
      createAnthropicMessage([fileBlock])
    );

    expect(content).toMatchObject({
      type: "document",
      source: { type: "file", file_id: "file-123" },
      cache_control: { type: "ephemeral", ttl: "5m" },
      citations: { enabled: true },
      context: "source context",
      title: "My Document",
    });
  });

  it("converts inlined text files into text document sources", () => {
    const fileBlock: ContentBlock.Multimodal.File = {
      type: "file",
      data: "Plain text body",
      mimeType: "text/plain",
    };

    const [content] = _formatStandardContent(
      createAnthropicMessage([fileBlock])
    );

    expect(content).toMatchObject({
      type: "document",
      source: {
        type: "text",
        data: "Plain text body",
        media_type: "text/plain",
      },
    });
  });

  it("wraps base64 image file payloads in document content blocks", () => {
    const imageData = Uint8Array.from([1, 2, 3]);
    const fileBlock: ContentBlock.Multimodal.File = {
      type: "file",
      data: imageData,
      mimeType: "image/png",
    };

    const [content] = _formatStandardContent(
      createAnthropicMessage([fileBlock])
    );

    expect(content).toMatchObject({
      type: "document",
      source: {
        type: "content",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              data: Buffer.from(imageData).toString("base64"),
              media_type: "image/png",
            },
          },
        ],
      },
    });
  });

  it("converts standard image blocks with metadata", () => {
    const imageBlock: ContentBlock.Multimodal.Image = {
      type: "image",
      url: "https://example.com/image.png",
      metadata: {
        cache_control: { type: "ephemeral", ttl: "1h" },
      },
    };

    const [content] = _formatStandardContent(
      createAnthropicMessage([imageBlock])
    );

    expect(content).toMatchObject({
      type: "image",
      source: { type: "url", url: "https://example.com/image.png" },
      cache_control: { type: "ephemeral", ttl: "1h" },
    });
  });

  it("promotes plain text blocks to Anthropic text documents", () => {
    const textBlock: ContentBlock.Multimodal.PlainText = {
      type: "text-plain",
      text: "Inline document",
      data: "Inline document",
      mimeType: "text/plain",
    };

    const message = createAnthropicMessage([textBlock]);
    expect(message.contentBlocks?.[0]?.type).toBe("text-plain");

    const formatted = _formatStandardContent(message);
    expect(formatted).toHaveLength(1);
    const [content] = formatted;

    expect(content).toMatchObject({
      type: "document",
      source: {
        type: "text",
        data: "Inline document",
        media_type: "text/plain",
      },
    });
  });

  it("throws for unsupported audio blocks", () => {
    const audioBlock: ContentBlock.Multimodal.Audio = {
      type: "audio",
      fileId: "audio-1",
    };

    expect(() =>
      _formatStandardContent(createAnthropicMessage([audioBlock]))
    ).toThrowError(/does not support audio/i);
  });
});
