/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect } from "@jest/globals";

import { EmbedbaseVectorStore } from "../embedbase.js";

test("Embedbase imports correctly", async () => {
  const EmbedbaseClient = await EmbedbaseVectorStore.imports();

  expect(EmbedbaseClient).toBeDefined();
});

test("EmbedbaseVectorStore with external ids", async () => {
  const client = {
    fetch: jest.fn(),
    embedbaseApiUrl: "https://api.embedbase.xyz",
    embedbaseApiKey: "key",
    headers: {},
    dataset: jest.fn().mockReturnValue({
      add: jest.fn(),
      search: jest.fn<any>().mockResolvedValue([]),
      batchAdd: jest.fn(),
    }),
  };

  const store = new EmbedbaseVectorStore({ embedbase: client as any });

  expect(store).toBeDefined();

  await store.addDocuments([
    {
      pageContent: "hello",
      metadata: {
        a: 1,
        b: { nested: [1, { a: 4 }] },
      },
    },
  ]);

  expect(client.dataset).toHaveBeenCalledTimes(1);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(0);
});

test("EmbedbaseVectorStore with generated ids", async () => {
  const client = {
    fetch: jest.fn(),
    embedbaseApiUrl: "https://api.embedbase.xyz",
    embedbaseApiKey: "key",
    headers: {},
    dataset: jest.fn().mockReturnValue({
      add: jest.fn(),
      search: jest.fn<any>().mockResolvedValue([]),
      batchAdd: jest.fn(),
    }),
  };

  const store = new EmbedbaseVectorStore({ embedbase: client as any });

  expect(store).toBeDefined();

  await store.addDocuments([{ pageContent: "hello", metadata: { a: 1 } }]);

  expect(client.dataset).toHaveBeenCalledTimes(1);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(0);
});
