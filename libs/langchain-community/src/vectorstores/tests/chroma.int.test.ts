/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, test } from "@jest/globals";
import { ChromaClient } from "chromadb";
import { faker } from "@faker-js/faker";
import * as uuid from "uuid";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "../chroma.js";

describe.skip("Chroma", () => {
  let chromaStore: Chroma;

  beforeEach(async () => {
    const embeddings = new OpenAIEmbeddings();
    chromaStore = new Chroma(embeddings, {
      url: "http://localhost:8000",
      collectionName: "test-collection",
    });
  });

  test.skip("auto-generated ids", async () => {
    const pageContent = faker.lorem.sentence(5);

    await chromaStore.addDocuments([{ pageContent, metadata: { foo: "bar" } }]);

    const results = await chromaStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({ metadata: { foo: "bar" }, pageContent }),
    ]);
  });

  test.skip("metadata filtering", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    await chromaStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: "qux" } },
    ]);

    // If the filter wasn't working, we'd get all 3 documents back
    const results = await chromaStore.similaritySearch(pageContent, 3, {
      foo: id,
    });

    expect(results).toEqual([
      new Document({ metadata: { foo: id }, pageContent }),
    ]);
  });

  test.skip("upsert", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    const ids = await chromaStore.addDocuments([
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id } },
    ]);

    const results = await chromaStore.similaritySearch(pageContent, 4, {
      foo: id,
    });

    expect(results.length).toEqual(2);

    const ids2 = await chromaStore.addDocuments(
      [
        { pageContent, metadata: { foo: id } },
        { pageContent, metadata: { foo: id } },
      ],
      { ids }
    );

    expect(ids).toEqual(ids2);

    const newResults = await chromaStore.similaritySearch(pageContent, 4, {
      foo: id,
    });

    expect(newResults.length).toEqual(2);
  });

  test.skip("delete by ids", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    const ids = await chromaStore.addDocuments([
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id } },
    ]);

    const results = await chromaStore.similaritySearch(pageContent, 2, {
      foo: id,
    });

    expect(results.length).toEqual(2);

    await chromaStore.delete({ ids: ids.slice(0, 1) });

    const newResults = await chromaStore.similaritySearch(pageContent, 2, {
      foo: id,
    });

    expect(newResults.length).toEqual(1);
  });

  test.skip("delete by filter", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();
    const id2 = uuid.v4();

    await chromaStore.addDocuments([
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id, bar: id2 } },
    ]);

    const results = await chromaStore.similaritySearch(pageContent, 2, {
      foo: id,
    });

    expect(results.length).toEqual(2);

    await chromaStore.delete({
      filter: {
        bar: id2,
      },
    });

    const newResults = await chromaStore.similaritySearch(pageContent, 2, {
      foo: id,
    });

    expect(newResults.length).toEqual(1);
  });

  test.skip("load from client instance", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    const chromaStoreFromClient = new Chroma(new OpenAIEmbeddings(), {
      index: new ChromaClient({
        path: "http://localhost:8000",
      }),
      collectionName: "test-collection",
    });

    await chromaStoreFromClient.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: "qux" } },
    ]);

    const results = await chromaStoreFromClient.similaritySearch(
      pageContent,
      3
    );

    expect(results.length).toEqual(3);
  });
});
