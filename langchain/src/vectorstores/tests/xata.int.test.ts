/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";
import { FakeEmbeddings } from "../../embeddings/fake.js";

import { XataStore } from "../xata.js";

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

  const mockResponse = { json: jest.fn<any>().mockResolvedValue(mockData) };
  const mockFetchPromise = Promise.resolve(
    new Response(JSON.stringify(mockResponse.json))
  );
  jest.spyOn(global, "fetch").mockImplementation(() => mockFetchPromise);

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
