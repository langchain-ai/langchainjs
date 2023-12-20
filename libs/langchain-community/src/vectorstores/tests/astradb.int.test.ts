/* eslint-disable no-process-env */
import { describe, expect, test } from "@jest/globals";
import { AstraDB } from "@datastax/astra-db-ts";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { AstraDBVectorStore, AstraLibArgs } from "../astradb.js";

const clientConfig = {
  token: process.env.ASTRA_TOKEN as string ?? 'AstraCS:lhxqJfOiEPpNZmknlxzUjIPP:e0c2a1b5be1e7f14c21a96af30a5fd1739fb045f19a11359bae7331b609c54e2',
  endpoint: process.env.ASTRA_ENDPOINT as string ?? 'https://cbfd30a0-243a-4c42-8422-78ce5f4752c9-us-east-2.apps.astra.datastax.com',
}
const client = new AstraDB(clientConfig.token, clientConfig.endpoint);

const astraConfig: AstraLibArgs = {
  ...clientConfig,
  collection: process.env.ASTRA_COLLECTION as string ?? 'langchain_test',
  idKey: "id",
  contentKey: "text",
  collectionOptions: {
    vector: {
      dimension: 1536,
      metric: "cosine",
    }
  }
};

describe('AstraDBVectorStore', () => { 
  beforeAll(async () => {
    try {
      await client.dropCollection(astraConfig.collection);
    } catch (e) {
      console.debug("Collection doesn't exist yet, skipping drop");
    }
  });

  test('AstraDBVectorStore.fromText', async () => {
    const store = await AstraDBVectorStore.fromTexts(
      ["AstraDB is built on Apache Cassandra", "AstraDB is a NoSQL DB", "AstraDB supports vector search"],
      [
        { id: 123 },
        { id: 456 },
        { id: 789 },
      ],
      new OpenAIEmbeddings(),
      astraConfig
    );

    const results = await store.similaritySearch(
      "Apache Cassandra",
      1
    );

    expect(results).toEqual([
      new Document({
        pageContent: "AstraDB is built on Apache Cassandra",
        metadata: { id: 123 },
      }),
    ]);
  });
});
