/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, test } from "@jest/globals";
import { faker } from "@faker-js/faker";
import { PineconeClient } from "@pinecone-database/pinecone";
import * as uuid from "uuid";
import { Document } from "../../document.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { PineconeStore } from "../pinecone.js";

describe("PineconeStore", () => {
  let pineconeStore: PineconeStore;

  beforeEach(async () => {
    const client = new PineconeClient();

    await client.init({
      environment: process.env.PINECONE_ENVIRONMENT!,
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const embeddings = new OpenAIEmbeddings();
    const pineconeIndex = client.Index(process.env.PINECONE_INDEX!);
    pineconeStore = new PineconeStore(embeddings, { pineconeIndex });
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
});
