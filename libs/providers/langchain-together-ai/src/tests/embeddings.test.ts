import { afterEach, describe, expect, test, vi } from "vitest";
import { TogetherAIEmbeddings } from "../embeddings.js";

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
  delete process.env.TOGETHER_AI_API_KEY;
});

describe("TogetherAIEmbeddings", () => {
  test("uses environment variable when apiKey is omitted", () => {
    process.env.TOGETHER_AI_API_KEY = "env-api-key";

    const embeddings = new TogetherAIEmbeddings();

    expect(embeddings.apiKey).toBe("env-api-key");
    expect(embeddings.model).toBe(
      "togethercomputer/m2-bert-80M-8k-retrieval"
    );
  });

  test("throws when api key is missing", () => {
    expect(() => new TogetherAIEmbeddings()).toThrow(
      "TOGETHER_AI_API_KEY not found."
    );
  });

  test("embedQuery strips new lines and sends auth header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        object: "list",
        data: [{ object: "embedding", embedding: [0.1, 0.2], index: 0 }],
        model: "test-model",
        request_id: "req_123",
      })
    );
    global.fetch = fetchMock as typeof fetch;

    const embeddings = new TogetherAIEmbeddings({
      apiKey: "test-api-key",
      model: "test-model",
      stripNewLines: true,
    });
    const result = await embeddings.embedQuery("hello\nworld");

    expect(result).toEqual([0.1, 0.2]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.together.xyz/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
      })
    );
    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(String(request?.body))).toEqual({
      model: "test-model",
      input: "hello world",
    });
  });

  test("embedDocuments preserves order across batches", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          object: "list",
          data: [{ object: "embedding", embedding: [1], index: 0 }],
          model: "test-model",
          request_id: "req_1",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          object: "list",
          data: [{ object: "embedding", embedding: [2], index: 0 }],
          model: "test-model",
          request_id: "req_2",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          object: "list",
          data: [{ object: "embedding", embedding: [3], index: 0 }],
          model: "test-model",
          request_id: "req_3",
        })
      );
    global.fetch = fetchMock as typeof fetch;

    const embeddings = new TogetherAIEmbeddings({
      apiKey: "test-api-key",
      model: "test-model",
      batchSize: 2,
    });
    const result = await embeddings.embedDocuments(["a", "b", "c"]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual([[1], [2], [3]]);
  });

  test("surfaces API errors", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ error: "bad request" }, 400)
    ) as typeof fetch;

    const embeddings = new TogetherAIEmbeddings({ apiKey: "test-api-key" });

    await expect(embeddings.embedQuery("hello")).rejects.toThrow(
      /Error getting prompt completion from Together AI/
    );
  });
});
