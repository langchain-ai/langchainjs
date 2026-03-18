import { HumanMessage } from "@langchain/core/messages";
import { formatMessagesForAnthropic } from "../anthropic.js";

function formatSingleContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const { messages } = formatMessagesForAnthropic([
    new HumanMessage({ content }),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (messages[0] as any).content;
}

describe("_formatContent via formatMessagesForAnthropic", () => {
  // --- Regression tests for existing behavior ---

  test("image_url content block", () => {
    const result = formatSingleContent([
      { type: "image_url", image_url: "data:image/png;base64,abc" },
    ]);
    expect(result).toEqual([
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: "abc" },
      },
    ]);
  });

  test("text content block", () => {
    const result = formatSingleContent([{ type: "text", text: "hello" }]);
    expect(result).toEqual([{ type: "text", text: "hello" }]);
  });

  // --- New multimodal standard types ---

  test("image with base64 string data", () => {
    const result = formatSingleContent([
      { type: "image", data: "abc", mimeType: "image/png" },
    ]);
    expect(result).toEqual([
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: "abc" },
      },
    ]);
  });

  test("image defaults to image/jpeg mime type", () => {
    const result = formatSingleContent([{ type: "image", data: "abc" }]);
    expect(result[0].source.media_type).toBe("image/jpeg");
  });

  test("file with base64 data", () => {
    const result = formatSingleContent([
      { type: "file", data: "pdf-data", mimeType: "application/pdf" },
    ]);
    expect(result).toEqual([
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: "pdf-data",
        },
      },
    ]);
  });

  test("file defaults to application/pdf mime type", () => {
    const result = formatSingleContent([{ type: "file", data: "pdf-data" }]);
    expect(result[0].source.media_type).toBe("application/pdf");
  });

  test("file with URL", () => {
    const result = formatSingleContent([
      { type: "file", url: "https://example.com/doc.pdf" },
    ]);
    expect(result).toEqual([
      {
        type: "document",
        source: { type: "url", url: "https://example.com/doc.pdf" },
      },
    ]);
  });

  test("document block is passed through", () => {
    const docBlock = {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: "some-data",
      },
    };
    const result = formatSingleContent([docBlock]);
    expect(result).toEqual([docBlock]);
  });

  test("audio content block is silently skipped", () => {
    const result = formatSingleContent([
      { type: "audio", data: "audio-data", mimeType: "audio/mp3" },
    ]);
    expect(result).toEqual([]);
  });

  test("video content block is silently skipped", () => {
    const result = formatSingleContent([
      { type: "video", data: "video-data", mimeType: "video/mp4" },
    ]);
    expect(result).toEqual([]);
  });

  // --- Legacy data content blocks (source_type) ---

  test("legacy image with source_type base64", () => {
    const result = formatSingleContent([
      {
        type: "image",
        source_type: "base64",
        data: "abc",
        mime_type: "image/png",
      },
    ]);
    expect(result).toEqual([
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: "abc" },
      },
    ]);
  });

  test("legacy file with source_type base64", () => {
    const result = formatSingleContent([
      {
        type: "file",
        source_type: "base64",
        data: "pdf",
        mime_type: "application/pdf",
      },
    ]);
    expect(result).toEqual([
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: "pdf",
        },
      },
    ]);
  });

  test("legacy file with source_type url", () => {
    const result = formatSingleContent([
      {
        type: "file",
        source_type: "url",
        url: "https://example.com/doc.pdf",
      },
    ]);
    expect(result).toEqual([
      {
        type: "document",
        source: { type: "url", url: "https://example.com/doc.pdf" },
      },
    ]);
  });

  // --- Mixed content ---

  test("mixed content: text + file + image in one message", () => {
    const result = formatSingleContent([
      { type: "text", text: "Check this document:" },
      { type: "file", data: "pdf-data", mimeType: "application/pdf" },
      { type: "image", data: "img-data", mimeType: "image/png" },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "text", text: "Check this document:" });
    expect(result[1].type).toBe("document");
    expect(result[1].source.type).toBe("base64");
    expect(result[2].type).toBe("image");
    expect(result[2].source.type).toBe("base64");
  });
});
