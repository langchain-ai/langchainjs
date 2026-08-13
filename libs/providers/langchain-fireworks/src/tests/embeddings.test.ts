import { afterEach, describe, expect, test, vi } from "vitest";
import {
  AuthenticationError,
  ContextOverflowError,
  ModelNotFoundError,
  PermissionDeniedError,
  QuotaExceededError,
  RateLimitError,
  ServerError,
  TimeoutError,
} from "@langchain/core/errors";

import { FireworksEmbeddings } from "../embeddings.js";

function mockErrorResponse(
  status: number,
  body: Record<string, unknown>,
  headers?: Record<string, string>
) {
  return {
    ok: false,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as Response;
}

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

  test("wraps 401 as AuthenticationError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockErrorResponse(401, { error: "invalid api key" })
    );
    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 0,
    });

    const error: AuthenticationError = await embeddings
      .embedQuery("hello world")
      .catch((e) => e);

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.statusCode).toBe(401);
    expect(error.isRetryable).toBe(false);
  });

  test("wraps 402 as non-retryable QuotaExceededError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockErrorResponse(402, { error: "payment required" })
    );
    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 0,
    });

    const error: QuotaExceededError = await embeddings
      .embedQuery("hello world")
      .catch((e) => e);

    expect(error).toBeInstanceOf(QuotaExceededError);
    expect(error.isRetryable).toBe(false);
  });

  test("wraps 403 as PermissionDeniedError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockErrorResponse(403, { error: "forbidden" })
    );
    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 0,
    });

    const error: PermissionDeniedError = await embeddings
      .embedQuery("hello world")
      .catch((e) => e);

    expect(error).toBeInstanceOf(PermissionDeniedError);
    expect(error.statusCode).toBe(403);
  });

  test("wraps 404 as ModelNotFoundError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockErrorResponse(404, { error: "model not found" })
    );
    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 0,
    });

    const error: ModelNotFoundError = await embeddings
      .embedQuery("hello world")
      .catch((e) => e);

    expect(error).toBeInstanceOf(ModelNotFoundError);
    expect(error.statusCode).toBe(404);
  });

  test("wraps 408 as TimeoutError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockErrorResponse(408, { error: "request timeout" })
    );
    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 0,
    });

    const error: TimeoutError = await embeddings
      .embedQuery("hello world")
      .catch((e) => e);

    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.isRetryable).toBe(true);
  });

  test("wraps 413 as ContextOverflowError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockErrorResponse(413, { error: "payload too large" })
    );
    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 0,
    });

    const error: ContextOverflowError = await embeddings
      .embedQuery("hello world")
      .catch((e) => e);

    expect(error).toBeInstanceOf(ContextOverflowError);
    expect(error.statusCode).toBe(413);
    expect(error.isRetryable).toBe(false);
  });

  test("wraps 429 as retryable RateLimitError with retryAfterMs from the header", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockErrorResponse(429, { error: "rate limited" }, { "retry-after": "2" })
    );
    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 0,
    });

    const error: RateLimitError = await embeddings
      .embedQuery("hello world")
      .catch((e) => e);

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.isRetryable).toBe(true);
    expect(error.retryAfterMs).toBe(2000);
  });

  test("wraps 500 as retryable ServerError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockErrorResponse(500, { error: "internal error" })
    );
    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 0,
    });

    const error: ServerError = await embeddings
      .embedQuery("hello world")
      .catch((e) => e);

    expect(error).toBeInstanceOf(ServerError);
    expect(error.statusCode).toBe(500);
    expect(error.isRetryable).toBe(true);
  });

  test("does not retry a 402 at the transport layer", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockErrorResponse(402, { error: "payment required" }));
    const embeddings = new FireworksEmbeddings({
      apiKey: "test-api-key",
      maxRetries: 3,
    });

    await expect(embeddings.embedQuery("hello world")).rejects.toBeInstanceOf(
      QuotaExceededError
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
