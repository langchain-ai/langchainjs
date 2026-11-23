import { describe, expect, vi, test } from "vitest";
import { GoogleGenerativeAIEmbeddings } from "../embeddings.js";

function mockEmbedContent(embeddings: GoogleGenerativeAIEmbeddings) {
  const embedContent = vi
    .fn()
    .mockResolvedValue({ embedding: { values: [0.1, 0.2] } });
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  (embeddings as any).client.embedContent = embedContent;
  return embedContent;
}

describe("GoogleGenerativeAIEmbeddings", () => {
  test("strips new lines from the input text by default", async () => {
    const embeddings = new GoogleGenerativeAIEmbeddings({ apiKey: "test" });
    const embedContent = mockEmbedContent(embeddings);

    await embeddings.embedQuery("line one\nline two");

    expect(embeddings.stripNewLines).toBe(true);
    expect(embedContent.mock.calls[0][0].content.parts[0].text).toBe(
      "line one line two"
    );
  });

  test("keeps new lines when stripNewLines is false", async () => {
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: "test",
      stripNewLines: false,
    });
    const embedContent = mockEmbedContent(embeddings);

    await embeddings.embedQuery("line one\nline two");

    expect(embeddings.stripNewLines).toBe(false);
    expect(embedContent.mock.calls[0][0].content.parts[0].text).toBe(
      "line one\nline two"
    );
  });
});
