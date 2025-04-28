/* eslint-disable no-process-env */
import { Index } from "@upstash/vector";
import { Document } from "@langchain/core/documents";
import {
  SyntheticEmbeddings,
  FakeEmbeddings,
} from "@langchain/core/utils/testing";
import { EmbeddingsInterface } from "@langchain/core/embeddings";
import { UpstashVectorStore } from "../upstash.js";
import { sleep } from "../../utils/time.js";

describe("UpstashVectorStore", () => {
  let store: UpstashVectorStore;
  let embeddings: EmbeddingsInterface;
  let index: Index;

  beforeEach(async () => {
    index = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });

    await index.reset();

    embeddings = new SyntheticEmbeddings({
      vectorSize: 384,
    });

    store = new UpstashVectorStore(embeddings, {
      index,
    });

    expect(store).toBeDefined();
  });

  test("basic operations with documents", async () => {
    const createdAt = new Date().getTime();

    const ids = await store.addDocuments([
      { pageContent: "hello", metadata: { a: createdAt + 1 } },
      { pageContent: "car", metadata: { a: createdAt } },
      { pageContent: "adjective", metadata: { a: createdAt } },
      { pageContent: "hi", metadata: { a: createdAt } },
    ]);

    // Sleeping for a second to make sure that all the indexing operations are finished.
    await sleep(1000);

    const results1 = await store.similaritySearchWithScore("hello!", 1);
    expect(results1).toHaveLength(1);

    expect([results1[0][0]]).toEqual([
      new Document({ metadata: { a: createdAt + 1 }, pageContent: "hello" }),
    ]);

    const results2 = await store.similaritySearchWithScore("testing!", 6);

    expect(results2).toHaveLength(4);

    await store.delete({ ids: ids.slice(2) });

    const results3 = await store.similaritySearchWithScore("testing again!", 6);

    expect(results3).toHaveLength(2);
  });

  test("UpstashVectorStore.fromText", async () => {
    const vectorStore = await UpstashVectorStore.fromTexts(
      ["hello there!", "what are you building?", "vectors are great!"],
      [
        { id: 1, name: "text1" },
        { id: 2, name: "text2" },
        { id: 3, name: "text3" },
      ],
      embeddings,
      { index }
    );

    // Sleeping for a second to make sure that all the indexing operations are finished.
    await sleep(1000);

    const results1 = await vectorStore.similaritySearch("vectors are great", 1);

    expect(results1).toEqual([
      new Document({
        pageContent: "vectors are great!",
        metadata: { id: 3, name: "text3" },
      }),
    ]);
  });

  test("UpstashVectorStore metadata filtering", async () => {
    const createdAt = new Date().getTime();

    await store.addDocuments([
      { pageContent: "banana", metadata: { creationTime: createdAt + 1 } },
      { pageContent: "car", metadata: { creationTime: createdAt } },
      { pageContent: "apple", metadata: { creationTime: createdAt } },
      { pageContent: "yellow", metadata: { time: createdAt } },
    ]);

    // Sleeping for a second to make sure that all the indexing operations are finished.
    await sleep(1000);

    const results1 = await store.similaritySearchWithScore(
      "banana",
      3,
      `creationTime = ${createdAt + 1}`
    );
    expect(results1).toHaveLength(1);

    expect([results1[0][0]]).toEqual([
      new Document({
        metadata: { creationTime: createdAt + 1 },
        pageContent: "banana",
      }),
    ]);

    const results2 = await store.similaritySearchWithScore(
      "car",
      4,
      `creationTime = ${createdAt - 1}`
    );

    expect(results2).toHaveLength(0);
  });

  test("UpstashVectorStore with Upstash Embedding configuration, the embeddings will be created by Upstash's service", async () => {
    const vectorStoreWithUpstashEmbeddings = new UpstashVectorStore(
      new FakeEmbeddings(),
      { index }
    );

    const createdAt = new Date().getTime();

    const ids = await vectorStoreWithUpstashEmbeddings.addDocuments([
      { pageContent: "hello", metadata: { a: createdAt + 1 } },
      { pageContent: "car", metadata: { a: createdAt } },
      { pageContent: "adjective", metadata: { a: createdAt } },
      { pageContent: "hi", metadata: { a: createdAt } },
    ]);

    // Sleeping for a second to make sure that all the indexing operations are finished.
    await sleep(1000);

    const results1 =
      await vectorStoreWithUpstashEmbeddings.similaritySearchVectorWithScore(
        "hello!",
        1
      );
    expect(results1).toHaveLength(1);

    expect([results1[0][0]]).toEqual([
      new Document({ metadata: { a: createdAt + 1 }, pageContent: "hello" }),
    ]);

    const results2 =
      await vectorStoreWithUpstashEmbeddings.similaritySearchVectorWithScore(
        "testing!",
        6
      );

    expect(results2).toHaveLength(4);

    await vectorStoreWithUpstashEmbeddings.delete({ ids: ids.slice(2) });

    const results3 =
      await vectorStoreWithUpstashEmbeddings.similaritySearchVectorWithScore(
        "testing again!",
        6
      );

    expect(results3).toHaveLength(2);
  });

  test("Should upsert the documents to target namespace", async () => {
    index = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });

    await index.reset();

    embeddings = new SyntheticEmbeddings({
      vectorSize: 384,
    });

    const storeNamespace1 = new UpstashVectorStore(embeddings, {
      index,
      namespace: "namespace-1",
    });
    const storeNamespace2 = new UpstashVectorStore(embeddings, {
      index,
      namespace: "namespace-2",
    });

    await storeNamespace1.addDocuments([
      {
        pageContent: "namespace-test-original",
        metadata: { namespace: "namespace-1" },
      },
    ]);

    // Sleeping for a second to make sure that all the indexing operations are finished.
    await sleep(1000);

    const resultsNamespace2 = await storeNamespace2.similaritySearchWithScore(
      "namespace-test-original",
      1,
      "namespace = 'namespace-1'"
    );
    expect(resultsNamespace2).toHaveLength(0);

    const resultsNamespace1 = await storeNamespace1.similaritySearchWithScore(
      "namespace-test-original",
      1,
      "namespace = 'namespace-1'"
    );
    expect(resultsNamespace1).toHaveLength(1);

    expect([resultsNamespace1[0][0]]).toEqual([
      new Document({
        metadata: { namespace: "namespace-1" },
        pageContent: "namespace-test-original",
      }),
    ]);
  });

  test("Should delete the documents from target namespace", async () => {
    index = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });

    await index.reset();

    embeddings = new SyntheticEmbeddings({
      vectorSize: 384,
    });

    const storeNamespace1 = new UpstashVectorStore(embeddings, {
      index,
      namespace: "namespace-1",
    });
    const storeNamespace2 = new UpstashVectorStore(embeddings, {
      index,
      namespace: "namespace-2",
    });

    const idNamespace1 = await storeNamespace1.addDocuments([
      {
        pageContent: "namespace-test-original",
        metadata: { namespace: "namespace-test" },
      },
    ]);
    await storeNamespace2.addDocuments([
      {
        pageContent: "namespace-test-original",
        metadata: { namespace: "namespace-test" },
      },
    ]);

    // Sleeping for a second to make sure that all the indexing operations are finished.
    await sleep(1000);

    await storeNamespace1.delete({ ids: idNamespace1 });

    const resultsNamespace1 = await storeNamespace1.similaritySearchWithScore(
      "namespace-test-original",
      1,
      "namespace = 'namespace-test'"
    );
    expect(resultsNamespace1).toHaveLength(0);

    const resultsNamespace2 = await storeNamespace2.similaritySearchWithScore(
      "namespace-test-original",
      1,
      "namespace = 'namespace-test'"
    );
    expect(resultsNamespace2).toHaveLength(1);

    expect([resultsNamespace2[0][0]]).toEqual([
      new Document({
        metadata: { namespace: "namespace-test" },
        pageContent: "namespace-test-original",
      }),
    ]);
  });
});
