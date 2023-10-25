/* eslint-disable no-process-env */
import { test, expect, describe } from "@jest/globals";

import { CassandraStore } from "../cassandra.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { Document } from "../../document.js";

// yarn test:single /langchain/src/vectorstores/tests/cassandra.int.test.ts
describe.skip("CassandraStore", () => {
  const cassandraConfig = {
    cloud: {
      secureConnectBundle: process.env.CASSANDRA_SCB as string,
    },
    credentials: {
      username: "token",
      password: process.env.CASSANDRA_TOKEN as string,
    },
    keyspace: "test",
    dimensions: 1536,
    table: "test",
    primaryKey: {
      name: "id",
      type: "int",
    },
    metadataColumns: [
      {
        name: "name",
        type: "text",
      },
    ],
  };

  test("CassandraStore.fromText", async () => {
    const vectorStore = await CassandraStore.fromTexts(
      ["I am blue", "Green yellow purple", "Hello there hello"],
      [
        { id: 2, name: "Alex" },
        { id: 1, name: "Scott" },
        { id: 3, name: "Bubba" },
      ],
      new OpenAIEmbeddings(),
      cassandraConfig
    );

    const results = await vectorStore.similaritySearch(
      "Green yellow purple",
      1
    );
    expect(results).toEqual([
      new Document({
        pageContent: "Green yellow purple",
        metadata: { id: 1, name: "Scott" },
      }),
    ]);
  });

  test("CassandraStore.fromExistingIndex", async () => {
    await CassandraStore.fromTexts(
      ["Hey", "Whats up", "Hello"],
      [
        { id: 2, name: "Alex" },
        { id: 1, name: "Scott" },
        { id: 3, name: "Bubba" },
      ],
      new OpenAIEmbeddings(),
      cassandraConfig
    );

    const vectorStore = await CassandraStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      cassandraConfig
    );

    const results = await vectorStore.similaritySearch("Whats up", 1);
    expect(results).toEqual([
      new Document({
        pageContent: "Whats up",
        metadata: { id: 1, name: "Scott" },
      }),
    ]);
  });

  test("CassandraStore.fromExistingIndex (with filter)", async () => {
    const testConfig = {
      ...cassandraConfig,
      indices: [
        {
          name: "name",
          value: "(name)",
        },
      ],
    };

    await CassandraStore.fromTexts(
      ["Hey", "Whats up", "Hello"],
      [
        { id: 2, name: "Alex" },
        { id: 1, name: "Scott" },
        { id: 3, name: "Bubba" },
      ],
      new OpenAIEmbeddings(),
      testConfig
    );

    const vectorStore = await CassandraStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      testConfig
    );

    const results = await vectorStore.similaritySearch("Hey", 1, {
      name: "Bubba",
    });
    expect(results).toEqual([
      new Document({
        pageContent: "Hello",
        metadata: { id: 3, name: "Bubba" },
      }),
    ]);
  });

  test("CassandraStore.addDocuments (with batch))", async () => {
    const testConfig = {
      ...cassandraConfig,
      maxConcurrency: 1,
      batchSize: 5,
    };

    const docs: Document[] = [];
    docs.push(
      new Document({
        pageContent: "Hello Muddah, hello Faddah",
        metadata: { id: 1, name: "Alex" },
      })
    );
    docs.push(
      new Document({
        pageContent: "Here I am at Camp Granada",
        metadata: { id: 2, name: "Blair" },
      })
    );
    docs.push(
      new Document({
        pageContent: "Camp is very entertaining",
        metadata: { id: 3, name: "Casey" },
      })
    );
    docs.push(
      new Document({
        pageContent: "And they say we'll have some fun if it stops raining",
        metadata: { id: 4, name: "Dana" },
      })
    );

    docs.push(
      new Document({
        pageContent: "I went hiking with Joe Spivey",
        metadata: { id: 5, name: "Amber" },
      })
    );
    docs.push(
      new Document({
        pageContent: "He developed poison ivy",
        metadata: { id: 6, name: "Blair" },
      })
    );
    docs.push(
      new Document({
        pageContent: "You remember Leonard Skinner",
        metadata: { id: 7, name: "Casey" },
      })
    );
    docs.push(
      new Document({
        pageContent: "He got Ptomaine poisoning last night after dinner",
        metadata: { id: 8, name: "Dana" },
      })
    );

    docs.push(
      new Document({
        pageContent: "All the counsellors hate the waiters",
        metadata: { id: 9, name: "Amber" },
      })
    );
    docs.push(
      new Document({
        pageContent: "And the lake has alligators",
        metadata: { id: 10, name: "Blair" },
      })
    );
    docs.push(
      new Document({
        pageContent: "And the head coach wants no sissies",
        metadata: { id: 11, name: "Casey" },
      })
    );
    docs.push(
      new Document({
        pageContent: "So he reads to us from something called Ulysses",
        metadata: { id: 12, name: "Dana" },
      })
    );

    const vectorStore = await CassandraStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      testConfig
    );

    await vectorStore.addDocuments(docs);

    const results = await vectorStore.similaritySearch(
      "something called Ulysses",
      1
    );
    expect(results).toEqual([
      new Document({
        pageContent: "So he reads to us from something called Ulysses",
        metadata: { id: 12, name: "Dana" },
      }),
    ]);
  });
});
