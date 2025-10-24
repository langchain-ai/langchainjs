/* eslint-disable no-process-env */
// eslint-disable-next-line import/no-extraneous-dependencies
import { BaseClient } from "@xata.io/client";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

import { XataVectorSearch } from "../xata.js";

// Tests require a DB with a table called "docs" with:
// * a column name content of type Text
// * a column named embedding of type Vector
// * a column named a of type Integer

test.skip("XataVectorSearch integration", async () => {
  if (!process.env.XATA_API_KEY) {
    throw new Error("XATA_API_KEY not set");
  }

  if (!process.env.XATA_DB_URL) {
    throw new Error("XATA_DB_URL not set");
  }
  const xata = new BaseClient({
    databaseURL: process.env.XATA_DB_URL,
    apiKey: process.env.XATA_API_KEY,
    branch: process.env.XATA_BRANCH || "main",
  });

  const table = "docs";
  const embeddings = new OpenAIEmbeddings();

  const store = new XataVectorSearch(embeddings, { client: xata, table });
  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  const ids1 = await store.addDocuments([
    { pageContent: "hello", metadata: { a: createdAt + 1 } },
    { pageContent: "car", metadata: { a: createdAt } },
    { pageContent: "adjective", metadata: { a: createdAt } },
    { pageContent: "hi", metadata: { a: createdAt } },
  ]);

  let results1 = await store.similaritySearch("hello!", 1);

  // search store is eventually consistent so we need to retry if nothing is
  // returned
  for (let i = 0; i < 5 && results1.length === 0; i += 1) {
    results1 = await store.similaritySearch("hello!", 1);
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 1000));
  }

  expect(results1).toHaveLength(1);
  expect(results1).toEqual([
    new Document({ metadata: { a: createdAt + 1 }, pageContent: "hello" }),
  ]);

  const results2 = await store.similaritySearchWithScore("testing!", 6, {
    a: createdAt,
  });
  expect(results2).toHaveLength(3);

  const ids2 = await store.addDocuments(
    [
      { pageContent: "hello upserted", metadata: { a: createdAt + 1 } },
      { pageContent: "car upserted", metadata: { a: createdAt } },
      { pageContent: "adjective upserted", metadata: { a: createdAt } },
      { pageContent: "hi upserted", metadata: { a: createdAt } },
    ],
    { ids: ids1 }
  );

  expect(ids1).toEqual(ids2);

  const results3 = await store.similaritySearchWithScore("testing!", 6, {
    a: createdAt,
  });

  expect(results3).toHaveLength(3);

  await store.delete({ ids: ids1.slice(2) });

  let results4 = await store.similaritySearchWithScore("testing!", 3, {
    a: createdAt,
  });
  for (let i = 0; i < 5 && results4.length > 1; i += 1) {
    results4 = await store.similaritySearchWithScore("testing!", 3, {
      a: createdAt,
    });
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 1000));
  }

  expect(results4).toHaveLength(1);

  await store.delete({ ids: ids1 });
  let results5 = await store.similaritySearch("hello!", 1);
  for (let i = 0; i < 5 && results1.length > 0; i += 1) {
    results5 = await store.similaritySearch("hello!", 1);
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 1000));
  }
  expect(results5).toHaveLength(0);
});

test.skip("Search a XataVectorSearch using a metadata filter", async () => {
  if (!process.env.XATA_API_KEY) {
    throw new Error("XATA_API_KEY not set");
  }

  if (!process.env.XATA_DB_URL) {
    throw new Error("XATA_DB_URL not set");
  }
  const xata = new BaseClient({
    databaseURL: process.env.XATA_DB_URL,
    apiKey: process.env.XATA_API_KEY,
    branch: process.env.XATA_BRANCH || "main",
  });

  const table = "docs";
  const embeddings = new OpenAIEmbeddings();

  const store = new XataVectorSearch(embeddings, { client: xata, table });
  expect(store).toBeDefined();

  const createdAt = new Date().getTime();

  const ids = await store.addDocuments([
    { pageContent: "hello 0", metadata: { a: createdAt } },
    { pageContent: "hello 1", metadata: { a: createdAt + 1 } },
    { pageContent: "hello 2", metadata: { a: createdAt + 2 } },
    { pageContent: "hello 3", metadata: { a: createdAt + 3 } },
  ]);

  // search store is eventually consistent so we need to retry if nothing is
  // returned
  let results1 = await store.similaritySearch("hello!", 1);
  for (let i = 0; i < 5 && results1.length < 4; i += 1) {
    results1 = await store.similaritySearch("hello", 6);
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 1000));
  }

  expect(results1).toHaveLength(4);

  const results = await store.similaritySearch("hello", 1, {
    a: createdAt + 2,
  });
  expect(results).toHaveLength(1);

  expect(results).toEqual([
    new Document({
      metadata: { a: createdAt + 2 },
      pageContent: "hello 2",
    }),
  ]);

  await store.delete({ ids });
  let results5 = await store.similaritySearch("hello!", 1);
  for (let i = 0; i < 5 && results1.length > 0; i += 1) {
    results5 = await store.similaritySearch("hello", 1);
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 1000));
  }
  expect(results5).toHaveLength(0);
});
