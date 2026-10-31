import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { VoyageContextualizedEmbeddings } from "../voyage_contextualized.js";

/**
 * Builds a mock contextualized embeddings response. `documents` is a nested
 * array mirroring the request input: each inner array holds the embeddings for
 * one document's chunks.
 */
function mockFetchResponse(documents: number[][][]): Response {
  return {
    ok: true,
    json: async () => ({
      object: "list",
      data: documents.map((chunks, docIndex) => ({
        object: "list",
        index: docIndex,
        data: chunks.map((embedding, index) => ({
          object: "embedding",
          embedding,
          index,
        })),
      })),
      model: "voyage-context-4",
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

describe("VoyageContextualizedEmbeddings constructor", () => {
  it("throws if no API key is available", () => {
    const k1 = process.env.VOYAGE_API_KEY;
    const k2 = process.env.VOYAGEAI_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGEAI_API_KEY;
    try {
      expect(
        () =>
          new VoyageContextualizedEmbeddings({ modelName: "voyage-context-4" })
      ).toThrow("Voyage AI API key not found");
    } finally {
      if (k1 !== undefined) process.env.VOYAGE_API_KEY = k1;
      if (k2 !== undefined) process.env.VOYAGEAI_API_KEY = k2;
    }
  });

  it("reads VOYAGE_API_KEY from env", () => {
    expect(
      () =>
        new VoyageContextualizedEmbeddings({ modelName: "voyage-context-4" })
    ).not.toThrow();
  });

  it("falls back to VOYAGEAI_API_KEY when VOYAGE_API_KEY is absent", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("VOYAGEAI_API_KEY", "fallback-key");
    expect(
      () =>
        new VoyageContextualizedEmbeddings({ modelName: "voyage-context-4" })
    ).not.toThrow();
  });

  it("explicit apiKey overrides env vars", () => {
    vi.unstubAllEnvs();
    expect(
      () =>
        new VoyageContextualizedEmbeddings({
          modelName: "voyage-context-4",
          apiKey: "explicit-key",
        })
    ).not.toThrow();
  });

  it("defaults to voyage-context-4 model", () => {
    const embeddings = new VoyageContextualizedEmbeddings();
    expect(embeddings.modelName).toBe("voyage-context-4");
  });

  it("targets the contextualizedembeddings endpoint by default", () => {
    const embeddings = new VoyageContextualizedEmbeddings();
    expect(embeddings.basePath).toBe("https://api.voyageai.com/v1");
    expect(embeddings.apiUrl).toBe(
      "https://api.voyageai.com/v1/contextualizedembeddings"
    );
  });

  it("accepts a custom basePath for MongoDB Atlas keys", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockFetchResponse([[[0.1, 0.2, 0.3]]]));

    const embeddings = new VoyageContextualizedEmbeddings({
      modelName: "voyage-context-4",
      basePath: "https://ai.mongodb.com/v1",
    });

    expect(embeddings.apiUrl).toBe(
      "https://ai.mongodb.com/v1/contextualizedembeddings"
    );

    await embeddings.embedQuery("test");
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://ai.mongodb.com/v1/contextualizedembeddings"
    );
  });
});

describe("VoyageContextualizedEmbeddings.embedQuery", () => {
  it("calls the API with a nested single-chunk input and returns the embedding", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockFetchResponse([[[0.1, 0.2, 0.3]]]));

    const embeddings = new VoyageContextualizedEmbeddings({
      modelName: "voyage-context-4",
    });
    const result = await embeddings.embedQuery("hello world");

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.voyageai.com/v1/contextualizedembeddings");
    expect((init as RequestInit).method).toBe("POST");

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("voyage-context-4");
    expect(body.input).toEqual([["hello world"]]);
    expect(body.input_type).toBe("query");
  });

  it("sends Authorization header with API key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchResponse([[[0.1]]])
    );

    const embeddings = new VoyageContextualizedEmbeddings({
      modelName: "voyage-context-4",
      apiKey: "my-secret-key",
    });
    await embeddings.embedQuery("test");

    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my-secret-key");
  });

  it("forwards outputDimension and outputDtype options", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockFetchResponse([[[0.1, 0.2]]]));

    const embeddings = new VoyageContextualizedEmbeddings({
      modelName: "voyage-context-4",
      outputDimension: 256,
      outputDtype: "int8",
    });
    await embeddings.embedQuery("test");

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.output_dimension).toBe(256);
    expect(body.output_dtype).toBe("int8");
  });
});

describe("VoyageContextualizedEmbeddings.embedDocuments", () => {
  it("treats each text as a single-chunk document and returns one embedding per text", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockFetchResponse([[[1, 0, 0]], [[0, 1, 0]], [[0, 0, 1]]])
      );

    const embeddings = new VoyageContextualizedEmbeddings({
      modelName: "voyage-context-4",
    });
    const result = await embeddings.embedDocuments(["foo", "bar", "baz"]);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.input).toEqual([["foo"], ["bar"], ["baz"]]);
    expect(body.input_type).toBe("document");
  });
});

describe("VoyageContextualizedEmbeddings.embedDocumentChunks", () => {
  it("preserves the nested document/chunk structure of the response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchResponse([
        [
          [1, 0],
          [0, 1],
        ],
        [[0.5, 0.5]],
      ])
    );

    const embeddings = new VoyageContextualizedEmbeddings({
      modelName: "voyage-context-4",
    });
    const result = await embeddings.embedDocumentChunks([
      ["chunk 1 of doc 1", "chunk 2 of doc 1"],
      ["chunk 1 of doc 2"],
    ]);

    expect(result).toEqual([
      [
        [1, 0],
        [0, 1],
      ],
      [[0.5, 0.5]],
    ]);

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.input).toEqual([
      ["chunk 1 of doc 1", "chunk 2 of doc 1"],
      ["chunk 1 of doc 2"],
    ]);
  });
});

describe("VoyageContextualizedEmbeddings error handling", () => {
  it("throws with status code on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchError(401, { detail: "Invalid API key" })
    );

    const embeddings = new VoyageContextualizedEmbeddings({
      modelName: "voyage-context-4",
    });
    await expect(embeddings.embedQuery("test")).rejects.toThrow(
      "Voyage AI API error (HTTP 401): Invalid API key"
    );
  });

  it("throws with nested error.message if present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchError(400, { error: { message: "Bad request" } })
    );

    const embeddings = new VoyageContextualizedEmbeddings({
      modelName: "voyage-context-4",
    });
    await expect(embeddings.embedQuery("test")).rejects.toThrow(
      "Voyage AI API error (HTTP 400): Bad request"
    );
  });
});
