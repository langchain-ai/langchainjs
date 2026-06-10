import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { VoyageEmbeddings } from "../voyage.js";

function mockFetchResponse(embeddings: number[][]): Response {
  return {
    ok: true,
    json: async () => ({
      object: "list",
      data: embeddings.map((embedding, index) => ({
        object: "embedding",
        embedding,
        index,
      })),
      model: "voyage-3",
      usage: { total_tokens: 10 },
    }),
  } as unknown as Response;
}

function mockFetchError(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubEnv("VOYAGE_API_KEY", "test-voyage-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("VoyageEmbeddings constructor", () => {
  it("throws if no API key is available", () => {
    const k1 = process.env.VOYAGE_API_KEY;
    const k2 = process.env.VOYAGEAI_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGEAI_API_KEY;
    try {
      expect(() => new VoyageEmbeddings({ modelName: "voyage-3" })).toThrow(
        "Voyage AI API key not found"
      );
    } finally {
      if (k1 !== undefined) process.env.VOYAGE_API_KEY = k1;
      if (k2 !== undefined) process.env.VOYAGEAI_API_KEY = k2;
    }
  });

  it("reads VOYAGE_API_KEY from env", () => {
    expect(() => new VoyageEmbeddings({ modelName: "voyage-3" })).not.toThrow();
  });

  it("falls back to VOYAGEAI_API_KEY when VOYAGE_API_KEY is absent", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("VOYAGEAI_API_KEY", "fallback-key");
    expect(() => new VoyageEmbeddings({ modelName: "voyage-3" })).not.toThrow();
  });

  it("explicit apiKey overrides env vars", () => {
    vi.unstubAllEnvs();
    expect(
      () =>
        new VoyageEmbeddings({ modelName: "voyage-3", apiKey: "explicit-key" })
    ).not.toThrow();
  });

  it("defaults to voyage-3 model", () => {
    const embeddings = new VoyageEmbeddings({ modelName: "voyage-3" });
    expect(embeddings.modelName).toBe("voyage-3");
  });

  it("defaults basePath to voyageai.com", () => {
    const embeddings = new VoyageEmbeddings({ modelName: "voyage-3" });
    expect(embeddings.basePath).toBe("https://api.voyageai.com/v1");
  });

  it("accepts a custom basePath for MongoDB Atlas keys", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockFetchResponse([[0.1, 0.2, 0.3]]));

    const embeddings = new VoyageEmbeddings({
      modelName: "voyage-3",
      basePath: "https://ai.mongodb.com/v1",
    });

    expect(embeddings.basePath).toBe("https://ai.mongodb.com/v1");
    expect(embeddings.apiUrl).toBe("https://ai.mongodb.com/v1/embeddings");

    await embeddings.embedQuery("test");
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://ai.mongodb.com/v1/embeddings"
    );
  });
});

describe("VoyageEmbeddings.embedQuery", () => {
  it("calls the API and returns the embedding", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockFetchResponse([[0.1, 0.2, 0.3]]));

    const embeddings = new VoyageEmbeddings({ modelName: "voyage-3" });
    const result = await embeddings.embedQuery("hello world");

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.voyageai.com/v1/embeddings");
    expect((init as RequestInit).method).toBe("POST");

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("voyage-3");
    expect(body.input).toBe("hello world");
  });

  it("sends Authorization header with API key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchResponse([[0.1]])
    );

    const embeddings = new VoyageEmbeddings({
      modelName: "voyage-3",
      apiKey: "my-secret-key",
    });
    await embeddings.embedQuery("test");

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my-secret-key");
  });
});

describe("VoyageEmbeddings.embedDocuments", () => {
  it("embeds a single batch in one request", async () => {
    const texts = ["foo", "bar", "baz"];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchResponse([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
    );

    const embeddings = new VoyageEmbeddings({ modelName: "voyage-3" });
    const result = await embeddings.embedDocuments(texts);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });

  it("splits texts into batches of batchSize and makes multiple requests", async () => {
    const texts = Array.from({ length: 10 }, (_, i) => `text-${i}`);
    const batch1 = texts.slice(0, 8).map((_, i) => [i, 0]);
    const batch2 = texts.slice(8).map((_, i) => [i + 8, 0]);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockFetchResponse(batch1))
      .mockResolvedValueOnce(mockFetchResponse(batch2));

    const embeddings = new VoyageEmbeddings({ modelName: "voyage-3" });
    const result = await embeddings.embedDocuments(texts);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(10);
    expect(result[0]).toEqual([0, 0]);
    expect(result[8]).toEqual([8, 0]);
  });
});

describe("VoyageEmbeddings error handling", () => {
  it("throws with status code on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchError(401, { detail: "Invalid API key" })
    );

    const embeddings = new VoyageEmbeddings({ modelName: "voyage-3" });
    await expect(embeddings.embedQuery("test")).rejects.toThrow(
      "Voyage AI API error (HTTP 401): Invalid API key"
    );
  });

  it("throws with nested error.message if present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchError(400, { error: { message: "Bad request" } })
    );

    const embeddings = new VoyageEmbeddings({ modelName: "voyage-3" });
    await expect(embeddings.embedQuery("test")).rejects.toThrow(
      "Voyage AI API error (HTTP 400): Bad request"
    );
  });
});
