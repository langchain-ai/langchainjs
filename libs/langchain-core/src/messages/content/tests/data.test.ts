import { describe, it, expect } from "vitest";
import {
  isDataContentBlock,
  convertToOpenAIImageBlock,
  convertToProviderContentBlock,
  type Data,
  type StandardContentBlockConverter,
} from "../data.js";

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
    const inputBlock: Data.URLContentBlock = {
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

    const inputBlock2: Data.Base64ContentBlock = {
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
    text: Data.StandardTextBlock;
    image: Data.StandardImageBlock;
    audio: Data.StandardAudioBlock;
    file: Data.StandardFileBlock;
  }> = {
    providerName: "test",

    fromStandardTextBlock(
      block: Data.StandardTextBlock
    ): Data.StandardTextBlock {
      return block;
    },

    fromStandardImageBlock(
      block: Data.StandardImageBlock
    ): Data.StandardImageBlock {
      return block;
    },

    fromStandardAudioBlock(
      block: Data.StandardAudioBlock
    ): Data.StandardAudioBlock {
      return block;
    },

    fromStandardFileBlock(
      block: Data.StandardFileBlock
    ): Data.StandardFileBlock {
      return block;
    },
  };

  const textBlocks: Data.StandardTextBlock[] = [
    {
      type: "text",
      source_type: "text",
      text: "foo",
      mime_type: "text/plain",
    } as Data.StandardTextBlock,
  ];

  const imageBlocks = [
    {
      type: "image",
      source_type: "url",
      url: "http://...",
      mime_type: "image/jpeg",
    } as Data.URLContentBlock,
    {
      type: "image",
      source_type: "base64",
      data: "<base64 data>",
      mime_type: "image/jpeg",
    } as Data.Base64ContentBlock,
    {
      type: "image",
      source_type: "id",
      id: "123",
      mime_type: "image/jpeg",
    } as Data.IDContentBlock,
  ] as Data.StandardImageBlock[];

  const audioBlocks = [
    {
      type: "audio",
      source_type: "url",
      url: "http://...",
    } as Data.URLContentBlock,
    {
      type: "audio",
      source_type: "base64",
      data: "<base64 data>",
      mime_type: "audio/mpeg",
    } as Data.Base64ContentBlock,
    {
      type: "audio",
      source_type: "id",
      id: "123",
      mime_type: "audio/mpeg",
    } as Data.IDContentBlock,
  ] as Data.StandardAudioBlock[];

  const fileBlocks = [
    {
      type: "file",
      source_type: "url",
      url: "http://...",
    } as Data.URLContentBlock,
    {
      type: "file",
      source_type: "base64",
      data: "<base64 data>",
      mime_type: "application/pdf",
    } as Data.Base64ContentBlock,
    {
      type: "file",
      source_type: "id",
      id: "123",
      mime_type: "application/pdf",
    } as Data.IDContentBlock,
    {
      type: "file",
      source_type: "text",
      text: "foo",
      mime_type: "text/plain",
    } as Data.PlainTextContentBlock,
  ] as Data.StandardFileBlock[];

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
          } as unknown as Data.DataContentBlock,
          adapter
        )
      ).toThrow();
    });
  });
});
