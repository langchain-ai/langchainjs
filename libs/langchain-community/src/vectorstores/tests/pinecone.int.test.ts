/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-promise-executor-return */
import { describe, expect, test } from "@jest/globals";
import { faker } from "@faker-js/faker";
import { Pinecone } from "@pinecone-database/pinecone";
import * as uuid from "uuid";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { PineconeLibArgs, PineconeStore } from "../pinecone.js";

describe("PineconeStore", () => {
  let pineconeStore: PineconeStore;
  const testIndexName = process.env.PINECONE_INDEX!;

  beforeAll(async () => {
    const embeddings = new OpenAIEmbeddings();

    const pinecone = new Pinecone();

    const pineconeIndex = pinecone.Index(testIndexName);

    const pineconeArgs: PineconeLibArgs = {
      pineconeIndex,
    };

    pineconeStore = new PineconeStore(embeddings, pineconeArgs);
  });

  test("user-provided ids", async () => {
    const documentId = uuid.v4();
    const pageContent = faker.lorem.sentence(5);

    await pineconeStore.addDocuments(
      [{ pageContent, metadata: {} }],
      [documentId]
    );

    const results = await pineconeStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([new Document({ metadata: {}, pageContent })]);

    await pineconeStore.addDocuments(
      [{ pageContent: `${pageContent} upserted`, metadata: {} }],
      [documentId]
    );

    const results2 = await pineconeStore.similaritySearch(pageContent, 1);

    expect(results2).toEqual([
      new Document({ metadata: {}, pageContent: `${pageContent} upserted` }),
    ]);
  });

  test("auto-generated ids", async () => {
    const pageContent = faker.lorem.sentence(5);

    await pineconeStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
    ]);

    const results = await pineconeStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({ metadata: { foo: "bar" }, pageContent }),
    ]);
  });

  test("metadata filtering", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    await pineconeStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: "qux" } },
    ]);

    // If the filter wasn't working, we'd get all 3 documents back
    const results = await pineconeStore.similaritySearch(pageContent, 3, {
      foo: id,
    });

    expect(results).toEqual([
      new Document({ metadata: { foo: id }, pageContent }),
    ]);
  });

  test("max marginal relevance", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    await pineconeStore.addDocuments([
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id } },
    ]);

    // If the filter wasn't working, we'd get all 3 documents back
    const results = await pineconeStore.maxMarginalRelevanceSearch(
      pageContent,
      {
        k: 5,
        fetchK: 20,
        filter: { foo: id },
      }
    );

    expect(results.length).toEqual(3);
  });

  test("delete by id", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    const ids = await pineconeStore.addDocuments([
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id } },
    ]);

    const results = await pineconeStore.similaritySearch(pageContent, 2, {
      foo: id,
    });

    expect(results.length).toEqual(2);

    await pineconeStore.delete({
      ids: ids.slice(0, 1),
    });

    const results2 = await pineconeStore.similaritySearch(pageContent, 2, {
      foo: id,
    });

    expect(results2.length).toEqual(1);
  });

  test("delete all", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    await pineconeStore.addDocuments([
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id } },
    ]);

    const results = await pineconeStore.similaritySearch(pageContent, 2, {
      foo: id,
    });

    expect(results.length).toEqual(2);

    await pineconeStore.delete({
      deleteAll: true,
    });

    const results2 = await pineconeStore.similaritySearch(pageContent, 2, {
      foo: id,
    });

    expect(results2.length).toEqual(0);
  });
});
