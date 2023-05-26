/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, test } from "@jest/globals";
import { faker } from "@faker-js/faker";
import { VectorDocumentStore } from "@tigrisdata/vector";
import * as uuid from "uuid";
import { Document } from "../../document.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { TigrisVectorStore } from "../tigris.js";

describe.skip("TigrisVectorStore", () => {
  let tigrisStore: TigrisVectorStore;

  beforeEach(async () => {
    const client = new VectorDocumentStore({
      connection: {
        serverUrl: process.env.TIGRIS_URI,
        projectName: process.env.TIGRIS_PROJECT,
        clientId: process.env.TIGRIS_CLIENT_ID,
        clientSecret: process.env.TIGRIS_CLIENT_SECRET,
      },
      indexName: "integration_test_index",
      numDimensions: 1536,
    });

    const embeddings = new OpenAIEmbeddings();
    tigrisStore = new TigrisVectorStore(embeddings, { index: client });
  });

  test("user-provided ids", async () => {
    const documentId = uuid.v4();
    const pageContent = faker.lorem.sentence(5);

    await tigrisStore.addDocuments(
      [{ pageContent, metadata: {} }],
      [documentId]
    );

    const results = await tigrisStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([new Document({ metadata: {}, pageContent })]);
  });

  test("auto-generated ids", async () => {
    const pageContent = faker.lorem.sentence(5);

    await tigrisStore.addDocuments([{ pageContent, metadata: { foo: "bar" } }]);

    const results = await tigrisStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({ metadata: { foo: "bar" }, pageContent }),
    ]);
  });

  test("metadata filtering", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    await tigrisStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: "qux" } },
    ]);

    // If the filter wasn't working, we'd get all 3 documents back
    const results = await tigrisStore.similaritySearch(pageContent, 3, {
      "metadata.foo": id,
    });

    expect(results).toEqual([
      new Document({ metadata: { foo: id }, pageContent }),
    ]);
  });
});
