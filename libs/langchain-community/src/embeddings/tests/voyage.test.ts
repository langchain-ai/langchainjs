import { jest, test, expect } from "@jest/globals";
import { VoyageEmbeddings } from "../voyage.js";

const mockFetch = (response: object, status = 200) => {
  return jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 401 ? "Unauthorized" : "OK",
      json: () => Promise.resolve(response),
    })
  ) as unknown as typeof fetch;
};

test("Test VoyageEmbeddings embedQuery returns embeddings on success", async () => {
  const embeddings = new VoyageEmbeddings({
    apiKey: "test-api-key",
    modelName: "voyage-3",
  });

  const mockResponse = {
    data: [{ embedding: [0.1, 0.2, 0.3] }],
    model: "voyage-3",
    usage: { total_tokens: 5 },
  };

  globalThis.fetch = mockFetch(mockResponse);

  const result = await embeddings.embedQuery("Hello world");
  expect(result).toEqual([0.1, 0.2, 0.3]);
});

test("Test VoyageEmbeddings embedDocuments returns embeddings on success", async () => {
  const embeddings = new VoyageEmbeddings({
    apiKey: "test-api-key",
    modelName: "voyage-3",
  });

  const mockResponse = {
    data: [
      { embedding: [0.1, 0.2, 0.3] },
      { embedding: [0.4, 0.5, 0.6] },
    ],
    model: "voyage-3",
    usage: { total_tokens: 10 },
  };

  globalThis.fetch = mockFetch(mockResponse);

  const result = await embeddings.embedDocuments(["Hello", "World"]);
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual([0.1, 0.2, 0.3]);
  expect(result[1]).toEqual([0.4, 0.5, 0.6]);
});

test("Test VoyageEmbeddings throws on HTTP error with detail message", async () => {
  const embeddings = new VoyageEmbeddings({
    apiKey: "invalid-key",
    modelName: "voyage-3",
    maxRetries: 0,
  });

  globalThis.fetch = mockFetch(
    { detail: "Provided API key is invalid." },
    401
  );

  await expect(embeddings.embedQuery("Hello world")).rejects.toThrow(
    /Voyage AI API error 401.*Provided API key is invalid/
  );
});

test("Test VoyageEmbeddings throws on HTTP error with non-detail body", async () => {
  const embeddings = new VoyageEmbeddings({
    apiKey: "test-api-key",
    modelName: "voyage-3",
    maxRetries: 0,
  });

  globalThis.fetch = mockFetch({ error: "Rate limit exceeded" }, 429);

  await expect(embeddings.embedQuery("Hello world")).rejects.toThrow(
    /Voyage AI API error 429/
  );
});

test("Test VoyageEmbeddings throws on server error", async () => {
  const embeddings = new VoyageEmbeddings({
    apiKey: "test-api-key",
    modelName: "voyage-3",
    maxRetries: 0,
  });

  globalThis.fetch = mockFetch({ detail: "Internal server error" }, 500);

  await expect(embeddings.embedDocuments(["Hello"])).rejects.toThrow(
    /Voyage AI API error 500.*Internal server error/
  );
});
