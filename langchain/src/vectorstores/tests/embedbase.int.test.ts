/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { createClient } from "embedbase-js";

import { Document } from "../../document.js";
import { EmbedbaseVectorStore } from "../embedbase.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";

test("EmbedbaseVectorStore add documents should create a dataset", async () => {
  const client = createClient(
    process.env.EMBEDBASE_URL || "https://api.embedbase.xyz",
    process.env.EMBEDBASE_API_KEY
  );

  const store = new EmbedbaseVectorStore({
    embedbase: client,
    datasetId: "foo",
  });

  expect(store).toBeDefined();

  await store.addDocuments([
    { pageContent: "hello", metadata: { a: 1 } },
    { pageContent: "hi", metadata: { a: 1 } },
    { pageContent: "bye", metadata: { a: 1 } },
    { pageContent: "what's this", metadata: { a: 1 } },
  ]);

  const results = await store.similaritySearch("hello", 1);

  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({ metadata: { a: 1 }, pageContent: "hello" }),
  ]);

  const datasets = await client.datasets();

  const datasetIds = datasets.map((dataset) => dataset.datasetId);

  expect(datasetIds).toContain("foo");
});

test("EmbedbaseVectorStore with static instantiation should create a dataset", async () => {
  const client = createClient(
    process.env.EMBEDBASE_URL || "https://api.embedbase.xyz",
    process.env.EMBEDBASE_API_KEY
  );

  await EmbedbaseVectorStore.fromTexts(
    ["Hello world", "Bye bye", "What's this?"],
    [
      { path: "/path/to/hello" },
      { path: "/path/to/bye" },
      { path: "/path/to/what" },
    ],
    // You don't need to deal with embeddings yourself, just pass in a fake one
    new FakeEmbeddings(),
    {
      embedbase: client,
      datasetId: "foo",
    }
  );

  const datasets = await client.datasets();

  const datasetIds = datasets.map((dataset) => dataset.datasetId);

  expect(datasetIds).toContain("foo");
});
