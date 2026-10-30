import { afterEach, describe, expect, test, vi } from "vitest";

import { FireworksEmbeddings } from "../embeddings.js";

afterEach(() => {
  vi.restoreAllMocks();
});

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
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.test/v1/embeddings",
      {
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
      }
    );
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

describe("FireworksEmbeddings retryability", () => {
  test("does not retry a deterministic 413", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({ error: "payload too large" }),
    } as Response);

    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 5,
    });

    await expect(embeddings.embedQuery("hello world")).rejects.toThrow(
      "Error 413: payload too large"
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("does not retry a bad API key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    } as Response);

    const embeddings = new FireworksEmbeddings({
      apiKey: "bad-key",
      maxRetries: 5,
    });

    await expect(embeddings.embedQuery("hello world")).rejects.toThrow(
      "Error 401: unauthorized"
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("still retries a transient 503", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: "unavailable" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.5] }] }),
      } as Response);

    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 3,
    });

    await expect(embeddings.embedQuery("hello world")).resolves.toEqual([0.5]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
