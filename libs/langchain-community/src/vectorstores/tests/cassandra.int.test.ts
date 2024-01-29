/* eslint-disable no-process-env */
import { test, expect, describe } from "@jest/globals";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { CasssandraClientFactory } from "../../utils/cassandra.js";
import { CassandraStore } from "../cassandra.js";

const cassandraConfig = {
  serviceProviderArgs: {
    astra: {
      token: process.env.ASTRA_TOKEN as string,
      endpoint: process.env.ASTRA_DB_ENDPOINT as string,
    },
  },
  keyspace: "test",
  table: "test",
};

let client;

const noPartitionConfig = {
  ...cassandraConfig,
  dimensions: 1536,
  primaryKey: {
    name: "id",
    type: "int",
  },
  metadataColumns: [
    {
      name: "name",
      type: "text",
    },
    {
      name: "seq",
      type: "int",
    },
  ],
};

// These tests are configured to run against an Astra database. You can run against Cassandra by
// updating the cassandraConfig above, and adjusting the environment variables as appropriate.
//
// Note there are multiple describe functions that need to be un-skipped for internal testing.
// To run these tests:
//   1. switch "describe.skip(" to "describe("
//   2. Export OPENAI_API_KEY, ASTRA_DB_ENDPOINT, and ASTRA_TOKEN
//   3. cd langchainjs/libs/langchain-community
//   4. yarn test:single src/vectorstores/tests/cassandra.int.test.ts
// Once manual testing is complete, re-instate the ".skip"
describe.skip("CassandraStore - no explicit partition key", () => {
  beforeAll(async () => {
    client = await CasssandraClientFactory.getClient(cassandraConfig);
    await client.execute("DROP TABLE IF EXISTS test.test;");
  });

  beforeEach(async () => {
    try {
      client = await CasssandraClientFactory.getClient(cassandraConfig);
      await client.execute("TRUNCATE test.test;");
    } catch (err) {
      // Ignore error if table does not exist
    }
  });

  test("CassandraStore.fromText", async () => {
    const vectorStore = await CassandraStore.fromTexts(
      ["I am blue", "Green yellow purple", "Hello there hello"],
      [
        { id: 2, name: "Alex" },
        { id: 1, name: "Scott" },
        { id: 3, name: "Bubba" },
      ],
      new OpenAIEmbeddings(),
      noPartitionConfig
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
      noPartitionConfig
    );

    const vectorStore = await CassandraStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      noPartitionConfig
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
      ...noPartitionConfig,
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

  test("CassandraStore.fromExistingIndex (with inequality filter)", async () => {
    const testConfig = {
      ...noPartitionConfig,
      indices: [
        {
          name: "seq",
          value: "(seq)",
        },
      ],
    };

    await CassandraStore.fromTexts(
      ["Hey", "Whats up", "Hello"],
      [
        { id: 2, name: "Alex", seq: 99 },
        { id: 1, name: "Scott", seq: 88 },
        { id: 3, name: "Bubba", seq: 77 },
      ],
      new OpenAIEmbeddings(),
      testConfig
    );

    const vectorStore = await CassandraStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      testConfig
    );

    // With out the filter this would match on Scott, but we are using > filter
    const results = await vectorStore.similaritySearch("Whats up", 1, [
      { name: "seq", operator: ">", value: "88" },
    ]);
    expect(results).toEqual([
      new Document({
        pageContent: "Hey",
        metadata: { id: 2, name: "Alex", seq: 99 },
      }),
    ]);
  });

  test("CassandraStore.addDocuments (with batch))", async () => {
    const testConfig = {
      ...noPartitionConfig,
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

  test("CassandraStore.mmr", async () => {
    const vectorStore = await CassandraStore.fromTexts(
      ["I am blue!", "I am blue!", "I am yellow"],
      [
        { id: 2, name: "Alex" },
        { id: 1, name: "Scott" },
        { id: 3, name: "Bubba" },
      ],
      new OpenAIEmbeddings(),
      noPartitionConfig
    );

    const results = await vectorStore.maxMarginalRelevanceSearch("I am blue!", {
      k: 2,
      fetchK: 3,
      lambda: 0,
    });

    // Check that the results array has exactly two documents.
    expect(results.length).toEqual(2);

    // Check if one of the documents has id=3.
    const hasId3 = results.some((doc) => doc.metadata.id === 3);
    expect(hasId3).toBeTruthy();
  });
});

describe.skip("CassandraStore - no explicit partition key", () => {
  beforeAll(async () => {
    client = await CasssandraClientFactory.getClient(cassandraConfig);
    await client.execute("DROP TABLE IF EXISTS test.test;");
  });

  test("CassandraStore.fromExistingIndex (with geo_distance filter)", async () => {
    const testConfig = {
      ...noPartitionConfig,
      metadataColumns: [
        {
          name: "name",
          type: "text",
        },
        {
          name: "coord",
          type: "VECTOR<FLOAT,2>",
        },
      ],
      indices: [
        {
          name: "coord",
          value: "(coord)",
          options: "{'similarity_function': 'euclidean' }",
        },
      ],
    };

    await CassandraStore.fromTexts(
      // This is a little Easter Egg for you physics people!
      ["Heavy", "Complex", "Intertwined"],
      [
        {
          id: 1,
          name: "Newton",
          coord: new Float32Array([51.5080181, -0.0776972]),
        },
        {
          id: 3,
          name: "Hamilton",
          coord: new Float32Array([53.3870814, -6.3375127]),
        },
        {
          id: 2,
          name: "Maxwell",
          coord: new Float32Array([52.2069212, 0.116913]),
        },
      ],
      new OpenAIEmbeddings(),
      testConfig
    );

    const vectorStore = await CassandraStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      testConfig
    );

    const results = await vectorStore.similaritySearch("Heavy", 1, [
      {
        name: "GEO_DISTANCE(coord, ?)",
        operator: "<",
        value: [new Float32Array([53.3730617, -6.3000515]), 10000],
      },
    ]);
    expect(results).toEqual([
      new Document({
        pageContent: "Complex",
        metadata: {
          id: 3,
          name: "Hamilton",
          coord: new Float32Array([53.3870814, -6.3375127]),
        },
      }),
    ]);
  });
});

const partitionConfig = {
  ...noPartitionConfig,
  primaryKey: [
    {
      name: "group",
      type: "int",
      partition: true,
    },
    {
      name: "ts",
      type: "timestamp",
    },
    {
      name: "id",
      type: "int",
    },
  ],
  withClause: "CLUSTERING ORDER BY (ts DESC)",
};

describe.skip("CassandraStore - with explicit partition key", () => {
  beforeAll(async () => {
    client = await CasssandraClientFactory.getClient(cassandraConfig);
    await client.execute("DROP TABLE IF EXISTS test.test;");
  });

  test("CassandraStore.partitionKey", async () => {
    const vectorStore = await CassandraStore.fromTexts(
      ["Hey", "Hey"],
      [
        { group: 1, ts: new Date(1655377200000), id: 1, name: "Alex" },
        { group: 2, ts: new Date(1655377200000), id: 1, name: "Alice" },
      ],
      new OpenAIEmbeddings(),
      partitionConfig
    );

    const results = await vectorStore.similaritySearch("Hey", 1, {
      group: 2,
    });

    expect(results).toEqual([
      new Document({
        pageContent: "Hey",
        metadata: {
          group: 2,
          ts: new Date(1655377200000),
          id: 1,
          name: "Alice",
        },
      }),
    ]);
  });

  test("CassandraStore.partition with cluster filter", async () => {
    const vectorStore = await CassandraStore.fromTexts(
      ["Apple", "Banana", "Cherry", "Date", "Elderberry"],
      [
        { group: 3, ts: new Date(1655377200000), id: 1, name: "Alex" },
        { group: 3, ts: new Date(1655377201000), id: 2, name: "Alex" },
        { group: 3, ts: new Date(1655377202000), id: 3, name: "Alex" },
        { group: 3, ts: new Date(1655377203000), id: 4, name: "Alex" },
        { group: 3, ts: new Date(1655377204000), id: 5, name: "Alex" },
      ],
      new OpenAIEmbeddings(),
      partitionConfig
    );

    await expect(
      vectorStore.similaritySearch("Banana", 1, [
        { name: "group", value: 1 },
        { name: "ts", value: new Date(1655377202000), operator: ">" },
      ])
    ).rejects.toThrow();

    // Once Cassandra supports filtering against non-indexed cluster columns, the following should work
    // expect(results).toEqual([
    //   new Document({
    //     pageContent: "Elderberry",
    //     metadata: { group: 1, ts: new Date(1655377204000), id: 5, name: "Alex", seq: null}
    //   }),
    // ]);
  });
});
