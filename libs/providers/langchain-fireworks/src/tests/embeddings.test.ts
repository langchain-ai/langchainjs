import { describe, expect, test, vi } from "vitest";

import { FireworksEmbeddings } from "../embeddings.js";

describe("FireworksEmbeddings", () => {
  test("uses the provided basePath and custom headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    } as Response);

    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      basePath: "https://example.test/v1",
      headers: {
        "X-Test": "yes",
      },
    });

    const result = await embeddings.embedQuery("hello world");

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(fetchSpy).toHaveBeenCalledWith("https://example.test/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-api-key",
        "X-Test": "yes",
      },
      body: JSON.stringify({
        model: "nomic-ai/nomic-embed-text-v1.5",
        input: "hello world",
      }),
    });
  });

  test("batches embedDocuments requests", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [1] }, { embedding: [2] }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [3] }],
        }),
      } as Response);

    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      batchSize: 2,
    });

    const result = await embeddings.embedDocuments(["a", "b", "c"]);

    expect(result).toEqual([[1], [2], [3]]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test("surfaces API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "bad request",
      }),
    } as Response);

    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 0,
    });

    await expect(embeddings.embedQuery("hello world")).rejects.toThrow(
      "Error 400: bad request"
    );
  });
});
