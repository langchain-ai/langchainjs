/* eslint-disable no-process-env */
import hanaClient from "@sap/hana-client";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { test, expect } from "@jest/globals";
import { HanaDB, HanaDBArgs } from "../hanavector.js";

// Connection parameters
const connectionParams = {
  host: process.env.HANA_HOST,
  port: process.env.HANA_PORT,
  uid: process.env.HANA_UID,
  pwd: process.env.HANA_PWD,
};

const embeddings = new OpenAIEmbeddings();
const testTableName = "test";

const client = hanaClient.createConnection();
client.connect(connectionParams);

beforeAll(async () => {
  expect(process.env.HANA_HOST).toBeDefined();
  expect(process.env.HANA_PORT).toBeDefined();
  expect(process.env.HANA_UID).toBeDefined();
  expect(process.env.HANA_PWD).toBeDefined();
  expect(process.env.OPENAI_API_KEY).toBeDefined();
});

describe("add documents and similarity search tests", () => {
  test("test fromText and default similarity search", async () => {
    const args: HanaDBArgs = {
      connection: client,
      tableName: testTableName,
    };
    const vectorStore = await HanaDB.fromTexts(
      ["Bye bye", "Hello world", "hello nice world"],
      [
        { id: 2, name: "2" },
        { id: 1, name: "1" },
        { id: 3, name: "3" },
      ],
      embeddings,
      args
    );
    expect(vectorStore).toBeDefined();

    const results = await vectorStore.similaritySearch("hello world", 1);
    // console.log(results)
    expect(results).toHaveLength(1);
    expect(results).toEqual([
      new Document({
        pageContent: "Hello world",
        metadata: { id: 1, name: "1" },
      }),
    ]);
  });

  test("performs addDocument and user defined similarity search", async () => {
    const args: HanaDBArgs = {
      connection: client,
      tableName: testTableName,
      distanceStrategy: "euclidean",
    };
    const vectorStore = new HanaDB(embeddings, args);
    expect(vectorStore).toBeDefined();
    await vectorStore.addDocuments([
      {
        pageContent: "This book is about politics",
        metadata: {
          source: "doc1",
          attributes: [{ key: "a", value: "1" }],
        },
      },
      {
        pageContent: "Cats sleeps a lot.",
        metadata: {
          source: "doc2",
          attributes: [{ key: "b", value: "1" }],
        },
      },
      {
        pageContent: "Sandwiches taste good.",
        metadata: {
          source: "doc3",
          attributes: [{ key: "c", value: "1" }],
        },
      },
      {
        pageContent: "The house is open",
        metadata: {
          source: "doc4",
          attributes: [
            { key: "d", value: "1" },
            { key: "e", value: "2" },
          ],
        },
      },
    ]);

    const results: Document[] = await vectorStore.similaritySearch(
      "sandwich",
      1
    );
    // console.log(results);
    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      {
        pageContent: "Sandwiches taste good.",
        metadata: {
          source: "doc3",
          attributes: [{ key: "c", value: "1" }],
        },
      },
    ]);

    const retriever = vectorStore.asRetriever({});

    const docs = await retriever.getRelevantDocuments("house");
    expect(docs).toBeDefined();
    expect(docs[0]).toMatchObject({
      pageContent: "The house is open",
      metadata: {
        source: "doc4",
        attributes: [
          { key: "d", value: "1" },
          { key: "e", value: "2" },
        ],
      },
    });
  });
});

describe("MMR search tests", () => {
  test("test delete by filter", async () => {
    const args: HanaDBArgs = {
      connection: client,
      tableName: testTableName,
    };
    // client.connect(connectionParams);
    const vectorStore = new HanaDB(embeddings, args);
    expect(vectorStore).toBeDefined();
    const filterTest = {};
    await vectorStore.delete({ filter: filterTest });
    const sql = `SELECT COUNT(*) AS row_count FROM "${args.tableName?.toUpperCase()}"`;
    const stm = client.prepare(sql);
    const resultSet = stm.execQuery();
    while (resultSet.next()) {
      const result = resultSet.getValue(0);
      expect(result).toEqual(0);
    }
  });

  test("performs max marginal relevance search", async () => {
    const args: HanaDBArgs = {
      connection: client,
      tableName: testTableName,
    };
    const texts = ["foo", "foo", "fox"];
    const vectorStore = await HanaDB.fromTexts(texts, {}, embeddings, args);

    const output = await vectorStore.maxMarginalRelevanceSearch("foo", {
      k: 3,
      fetchK: 20,
      lambda: 0,
    });

    expect(output).toHaveLength(3);

    const actual = output.map((doc) => doc.pageContent);
    // console.log(actual);
    const expected = ["foo", "fox", "foo"];
    expect(actual).toEqual(expected);

    const standardRetriever = vectorStore.asRetriever();

    const standardRetrieverOutput =
      await standardRetriever.getRelevantDocuments("foo");
    expect(output).toHaveLength(texts.length);

    const standardRetrieverActual = standardRetrieverOutput.map(
      (doc) => doc.pageContent
    );
    const standardRetrieverExpected = ["foo", "foo", "fox"];
    expect(standardRetrieverActual).toEqual(standardRetrieverExpected);

    const retriever = vectorStore.asRetriever({
      searchType: "mmr",
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });

    const retrieverOutput = await retriever.getRelevantDocuments("foo");
    expect(output).toHaveLength(texts.length);

    const retrieverActual = retrieverOutput.map((doc) => doc.pageContent);
    const retrieverExpected = ["foo", "fox", "foo"];
    expect(retrieverActual).toEqual(retrieverExpected);

    const similarity = await vectorStore.similaritySearchWithScore("foo", 1);
    expect(similarity.length).toBe(1);
  });
});

describe("Filter tests", () => {
  test("test query documents with specific metadata", async () => {
    const args: HanaDBArgs = {
      connection: client,
      tableName: testTableName,
    };
    // client.connect(connectionParams);
    const vectorStore = new HanaDB(embeddings, args);
    expect(vectorStore).toBeDefined();
    const docs: Document[] = [
      {
        pageContent: "foo",
        metadata: { start: 100, end: 150, docName: "foo.txt", quality: "bad" },
      },
      {
        pageContent: "bar",
        metadata: { start: 200, end: 250, docName: "bar.txt", quality: "good" },
      },
    ];
    await vectorStore.addDocuments(docs);
    const filter = { quality: "bad" };
    const query = "foobar";

    const results = await vectorStore.similaritySearch(query, 1, filter);
    expect(results.length).toEqual(1);
    expect(results).toMatchObject([
      {
        pageContent: "foo",
        metadata: { start: 100, end: 150, docName: "foo.txt", quality: "bad" },
      },
    ]);
  });

  test("test delete documents with specific metadata", async () => {
    const args: HanaDBArgs = {
      connection: client,
      tableName: testTableName,
    };
    // client.connect(connectionParams);
    const vectorStore = new HanaDB(embeddings, args);
    expect(vectorStore).toBeDefined();
    const filterTest = { quality: "good" };
    await vectorStore.delete({ filter: filterTest });
    const sql = `SELECT COUNT(*) AS row_count FROM "${args.tableName?.toUpperCase()}" WHERE  JSON_VALUE(VEC_META, '$.quality') = 'good'`;
    const stm = client.prepare(sql);
    const resultSet = stm.execQuery();
    while (resultSet.next()) {
      const result = resultSet.getValue(0);
      expect(result).toEqual(0);
    }
  });
});
