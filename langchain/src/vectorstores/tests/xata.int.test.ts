/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "../../embeddings/fake.js";

import { XataStore } from "../xata.js";

describe("Xata Vector Store", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("Xata Vector Store with generated ids", async () => {
    const mockData = {
      records: [
        {
          "test-text-column": "hello",
          "test-vector-column": [0.1, 0.2, 0.3, 0.4],
          a: 1,
        },
      ],
    };

    const mockFetch = (
      ..._args: Parameters<typeof fetch>
    ): Promise<Response> => {
      const mockResponse = new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { "Content-type": "application/json" },
      });

      return Promise.resolve(mockResponse);
    };
    jest.spyOn(global, "fetch").mockImplementation(mockFetch);

    const embeddings = new FakeEmbeddings();
    const store = new XataStore(embeddings, {
      apiKey: "test-api-key",
      workspaceSlug: "test-workspace",
      region: "test-region",
      db: "test-db",
      tableName: "test-table",
      textColumn: "test-text-column",
      vectorColumn: "test-vector-column",
      otherColumns: ["a"],
    });

    expect(store).toBeDefined();

    await store.addDocuments([{ pageContent: "hello", metadata: { a: 1 } }]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://test-workspace.test-region.xata.sh/db/test-db:main/tables/test-table/bulk",
      {
        method: "POST",
        body: JSON.stringify(mockData),
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
      }
    );
  });

  test("Xata Vector Store Vector Search", async () => {
    const mockPost = {
      queryVector: [0.1, 0.2, 0.3, 0.4],
      size: 1,
      column: "test-vector-column",
    };

    const mockData = {
      records: [
        {
          xata: {
            score: 1,
          },
          "test-text-column": "hello",
          "test-vector-column": [0.1, 0.2, 0.3, 0.4],
          a: 1,
        },
      ],
    };

    const mockFetch = (
      ..._args: Parameters<typeof fetch>
    ): Promise<Response> => {
      const mockResponse = new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { "Content-type": "application/json" },
        statusText: "OK",
      });

      return Promise.resolve(mockResponse);
    };
    jest.spyOn(global, "fetch").mockImplementation(mockFetch);

    const embeddings = new FakeEmbeddings();
    const store = new XataStore(embeddings, {
      apiKey: "test-api-key",
      workspaceSlug: "test-workspace",
      region: "test-region",
      db: "test-db",
      tableName: "test-table",
      textColumn: "test-text-column",
      vectorColumn: "test-vector-column",
      otherColumns: ["a"],
    });

    expect(store).toBeDefined();
    await store.similaritySearch("test", 1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://test-workspace.test-region.xata.sh/db/test-db:main/tables/test-table/vectorSearch",
      {
        method: "POST",
        body: JSON.stringify(mockPost),
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
      }
    );
  });
});
