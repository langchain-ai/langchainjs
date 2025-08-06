import { describe, it, expect } from "vitest";
import {
  isDataContentBlock,
  convertToOpenAIImageBlock,
  type URLContentBlock,
  type Base64ContentBlock,
  type StandardContentBlockConverter,
  type StandardTextBlock,
  type DataContentBlock,
  type StandardImageBlock,
  type StandardAudioBlock,
  type StandardFileBlock,
  type IDContentBlock,
  PlainTextContentBlock,
  convertToProviderContentBlock,
} from "../content_blocks.js";

describe("isDataContentBlock", () => {
  it("should return true for valid DataContentBlock objects", () => {
    expect(
      isDataContentBlock({
        type: "image",
        source_type: "url",
        url: "https://...",
      })
    ).toBe(true);

    expect(
      isDataContentBlock({
        type: "image",
        source_type: "base64",
        data: "<base64 data>",
        mime_type: "image/jpeg",
      })
    ).toBe(true);

    expect(
      isDataContentBlock({
        type: "image",
        source_type: "base64",
        data: "<base64 data>",
        mime_type: "image/jpeg",
        metadata: { cache_control: { type: "ephemeral" } },
      })
    ).toBe(true);
  });
  it("should return false for invalid DataContentBlock objects", () => {
    expect(
      isDataContentBlock({
        type: "text",
        text: "foo",
      })
    ).toBe(false);

    expect(
      isDataContentBlock({
        type: "image_url",
        image_url: { url: "https://..." },
      })
    ).toBe(false);

    expect(
      isDataContentBlock({
        type: "image",
        source: "<base64 data>",
      })
    ).toBe(false);
  });
});

describe("convertToOpenAIImageBlock", () => {
  it("should convert a valid DataContentBlock to OpenAI image block", () => {
    const inputBlock: URLContentBlock = {
      type: "image",
      source_type: "url",
      url: "https://...",
      metadata: { cache_control: { type: "ephemeral" } },
    };
    const expected = {
      type: "image_url",
      image_url: { url: "https://..." },
    };
    const result = convertToOpenAIImageBlock(inputBlock);
    expect(result).toEqual(expected);

    const inputBlock2: Base64ContentBlock = {
      type: "image",
      source_type: "base64",
      data: "<base64 data>",
      mime_type: "image/jpeg",
      metadata: { cache_control: { type: "ephemeral" } },
    };
    const expected2 = {
      type: "image_url",
      image_url: {
        url: "data:image/jpeg;base64,<base64 data>",
      },
    };
    const result2 = convertToOpenAIImageBlock(inputBlock2);
    expect(result2).toEqual(expected2);
  });
});

describe("DataContentBlockAdapter", () => {
  const adapter: StandardContentBlockConverter<{
    text: StandardTextBlock;
    image: StandardImageBlock;
    audio: StandardAudioBlock;
    file: StandardFileBlock;
  }> = {
    providerName: "test",

    fromStandardTextBlock(block: StandardTextBlock): StandardTextBlock {
      return block;
    },

    fromStandardImageBlock(block: StandardImageBlock): StandardImageBlock {
      return block;
    },

    fromStandardAudioBlock(block: StandardAudioBlock): StandardAudioBlock {
      return block;
    },

    fromStandardFileBlock(block: StandardFileBlock): StandardFileBlock {
      return block;
    },
  };

  const textBlocks: StandardTextBlock[] = [
    {
      type: "text",
      source_type: "text",
      text: "foo",
      mime_type: "text/plain",
    } as StandardTextBlock,
  ];

  const imageBlocks = [
    {
      type: "image",
      source_type: "url",
      url: "http://...",
      mime_type: "image/jpeg",
    } as URLContentBlock,
    {
      type: "image",
      source_type: "base64",
      data: "<base64 data>",
      mime_type: "image/jpeg",
    } as Base64ContentBlock,
    {
      type: "image",
      source_type: "id",
      id: "123",
      mime_type: "image/jpeg",
    } as IDContentBlock,
  ] as StandardImageBlock[];

  const audioBlocks = [
    {
      type: "audio",
      source_type: "url",
      url: "http://...",
    } as URLContentBlock,
    {
      type: "audio",
      source_type: "base64",
      data: "<base64 data>",
      mime_type: "audio/mpeg",
    } as Base64ContentBlock,
    {
      type: "audio",
      source_type: "id",
      id: "123",
      mime_type: "audio/mpeg",
    } as IDContentBlock,
  ] as StandardAudioBlock[];

  const fileBlocks = [
    {
      type: "file",
      source_type: "url",
      url: "http://...",
    } as URLContentBlock,
    {
      type: "file",
      source_type: "base64",
      data: "<base64 data>",
      mime_type: "application/pdf",
    } as Base64ContentBlock,
    {
      type: "file",
      source_type: "id",
      id: "123",
      mime_type: "application/pdf",
    } as IDContentBlock,
    {
      type: "file",
      source_type: "text",
      text: "foo",
      mime_type: "text/plain",
    } as PlainTextContentBlock,
  ] as StandardFileBlock[];

  describe("convertToProviderContentBlock", () => {
    it("should convert text blocks", () => {
      for (const textBlock of textBlocks) {
        const result = convertToProviderContentBlock(textBlock, adapter);
        expect(result).toEqual(textBlock);
      }
    });

    it("should convert image blocks", () => {
      for (const imageBlock of imageBlocks) {
        const result = convertToProviderContentBlock(imageBlock, adapter);
        expect(result).toEqual(imageBlock);
      }
    });

    it("should convert audio blocks", () => {
      for (const audioBlock of audioBlocks) {
        const result = convertToProviderContentBlock(audioBlock, adapter);
        expect(result).toEqual(audioBlock);
      }
    });

    it("should convert file blocks", () => {
      for (const fileBlock of fileBlocks) {
        const result = convertToProviderContentBlock(fileBlock, adapter);
        expect(result).toEqual(fileBlock);
      }
    });

    it("should throw an error for unsupported block types", () => {
      expect(() =>
        convertToProviderContentBlock(
          {
            type: "unknown",
            source_type: "text",
            text: "foo",
          } as unknown as DataContentBlock,
          adapter
        )
      ).toThrow();
    });
  });
});
