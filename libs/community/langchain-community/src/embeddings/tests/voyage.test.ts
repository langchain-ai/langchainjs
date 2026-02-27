import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { VoyageEmbeddings } from "../voyage.js";

describe("VoyageEmbeddings", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("uses basePath provided in constructor", async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    } as Response);
    global.fetch = fetchMock;

    const embeddings = new VoyageEmbeddings({
      apiKey: "test-key",
      basePath: "https://ai.mongodb.com/v1",
    });

    await embeddings.embedQuery("Hello world");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ai.mongodb.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  test("uses apiUrl provided in constructor", async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    } as Response);
    global.fetch = fetchMock;

    const embeddings = new VoyageEmbeddings({
      apiKey: "test-key",
      apiUrl: "https://ai.mongodb.com/v1/embeddings",
    });

    await embeddings.embedQuery("Hello world");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ai.mongodb.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
