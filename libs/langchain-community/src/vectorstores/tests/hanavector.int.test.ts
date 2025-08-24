/* eslint-disable @typescript-eslint/no-explicit-any */
import hdbClient from "hdb";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { test, expect } from "@jest/globals";
import { HanaDB, HanaDBArgs } from "../hanavector.js";
import {
  DOCUMENTS,
  TYPE_1_FILTERING_TEST_CASES,
  TYPE_2_FILTERING_TEST_CASES,
  TYPE_3_FILTERING_TEST_CASES,
  TYPE_4_FILTERING_TEST_CASES,
  TYPE_5_FILTERING_TEST_CASES,
  TYPE_6_FILTERING_TEST_CASES,
} from "./hanavector.fixtures.js";
// Connection parameters
const connectionParams = {
  host: process.env.HANA_HOST,
  port: process.env.HANA_PORT,
  user: process.env.HANA_UID,
  password: process.env.HANA_PWD,
  // useCesu8 : false
};

//  Fake normalized embeddings which remember all the texts seen so far to return consistent vectors for the same texts.
class NormalizedConsistentFakeEmbeddings extends FakeEmbeddings {
  private knownTexts: string[];

  private dimensionality: number;

  constructor(dimensionality = 10) {
    super();
    this.knownTexts = [];
    this.dimensionality = dimensionality;
  }

  private normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0));
    return vector.map((v) => v / norm);
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    const outVectors: number[][] = texts.map((text) => {
      let index = this.knownTexts.indexOf(text);
      if (index === -1) {
        this.knownTexts.push(text);
        index = this.knownTexts.length - 1;
      }
      // Create an embedding with `dimensionality - 1` elements set to 1.0, and the last element set to the index
      const vector = new Array(this.dimensionality - 1).fill(1.0).concat(index);
      return this.normalize(vector);
    });

    return Promise.resolve(outVectors);
  }

  public async embedQuery(text: string): Promise<number[]> {
    const embedding = this.embedDocuments([text]).then(
      (embeddings) => embeddings[0]
    );
    return embedding;
  }
}

const embeddings = new NormalizedConsistentFakeEmbeddings();

const client = hdbClient.createClient(connectionParams);

async function connectToHANA() {
  try {
    await new Promise<void>((resolve, reject) => {
      client.connect((err: Error) => {
        // Use arrow function here
        if (err) {
          reject(err);
        } else {
          // console.log("Connected to SAP HANA successfully.");
          resolve();
        }
      });
    });
  } catch (error) {
    // console.error("Connect error", error);
  }
}

function executeQuery(client: any, query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    client.exec(query, (err: Error, result: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

function prepareQuery(client: any, query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    client.prepare(query, (err: Error, statement: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(statement);
      }
    });
  });
}

function executeStatement(statement: any, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    statement.exec(params, (err: Error, res: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

beforeAll(async () => {
  expect(process.env.HANA_HOST).toBeDefined();
  expect(process.env.HANA_PORT).toBeDefined();
  expect(process.env.HANA_UID).toBeDefined();
  expect(process.env.HANA_PWD).toBeDefined();
  await connectToHANA();
});

afterAll(async () => {
  client.disconnect();
});

async function dropTable(client: any, tableName: string) {
  try {
    const query = `DROP TABLE "${tableName}"`;
    await executeQuery(client, query);
    // console.log(`Table ${tableName} dropped successfully.`);
  } catch (error) {
    // console.error(`Error dropping table ${tableName}:`, error);
  }
}

test("test initialization and table non-exist", async () => {
  const tableNameTest = "TABLE_INITIALIZE";
  const args: HanaDBArgs = {
    connection: client,
    tableName: tableNameTest,
  };
  const vectorStore = new HanaDB(embeddings, args);
  expect(vectorStore).toBeDefined();
  await dropTable(client, tableNameTest);
  let result = await vectorStore.tableExists(tableNameTest);
  expect(result).toEqual(false);
  await vectorStore.initialize();
  result = await vectorStore.tableExists(tableNameTest);
  expect(result).toEqual(true);
});

describe("add documents and similarity search tests", () => {
  test("test fromText and default similarity search", async () => {
    const tableNameTest = "TEST_ADD_TEXT";
    await dropTable(client, tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
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

    const results = await vectorStore.similaritySearch("Hello world", 1);
    // console.log(results)
    expect(results).toHaveLength(1);
    expect(results).toEqual([
      new Document({
        pageContent: "Hello world",
        metadata: { id: 1, name: "1" },
      }),
    ]);
  });

  test("test addVector with provided embedding", async () => {
    const tableNameTest = "TEST_ADD_VEC_WITH_EMBEDDING";
    await dropTable(client, tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    const vectorStore = new HanaDB(embeddings, args);
    await vectorStore.initialize();
    expect(vectorStore).toBeDefined();
    await vectorStore.addVectors(
      [
        [1, 2],
        [3, 4],
        [3, 5],
      ],
      [
        {
          pageContent: "Bye bye",
          metadata: {
            id: 2,
            name: "2",
          },
        },
        {
          pageContent: "Hello world",
          metadata: {
            id: 1,
            name: "1",
          },
        },
        {
          pageContent: "hello nice world",
          metadata: {
            id: 3,
            name: "3",
          },
        },
      ]
    );
    expect(await vectorStore.tableExists(tableNameTest)).toBe(true);
  });

  test("performs addDocument and user defined similarity search", async () => {
    const tableNameTest = "TEST_ADD_DOC";
    await dropTable(client, tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
      distanceStrategy: "euclidean",
    };
    const vectorStore = new HanaDB(embeddings, args);
    await vectorStore.initialize();
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
      "Sandwiches taste good.",
      1
    );
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

  test("performs max marginal relevance search", async () => {
    const tableNameTest = "TEST_MRR";
    await dropTable(client, tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
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

  test("test query documents with specific metadata", async () => {
    const tableNameTest = "TEST_FILTER";
    await dropTable(client, tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    // client.connect(connectionParams);
    const vectorStore = new HanaDB(embeddings, args);
    await vectorStore.initialize();
    expect(vectorStore).toBeDefined();
    const docs: Document[] = [
      {
        pageContent: "foo",
        metadata: {
          start: 100,
          end: 150,
          docName: "foo.txt",
          quality: "bad",
          ready: true,
        },
      },
      {
        pageContent: "bar",
        metadata: {
          start: 200,
          end: 250,
          docName: "bar.txt",
          quality: "good",
          ready: false,
        },
      },
    ];
    await vectorStore.addDocuments(docs);
    const filterString = { quality: "bad" };
    const query = "foo";

    const resultsString = await vectorStore.similaritySearch(
      query,
      1,
      filterString
    );
    expect(resultsString.length).toEqual(1);
    expect(resultsString).toMatchObject([
      {
        pageContent: "foo",
        metadata: {
          start: 100,
          end: 150,
          docName: "foo.txt",
          quality: "bad",
          ready: true,
        },
      },
    ]);

    const filterNumber = { start: 100, end: 150 };
    const resultsNumber = await vectorStore.similaritySearch(
      query,
      1,
      filterNumber
    );
    expect(resultsNumber.length).toEqual(1);
    expect(resultsNumber).toMatchObject([
      {
        pageContent: "foo",
        metadata: {
          start: 100,
          end: 150,
          docName: "foo.txt",
          quality: "bad",
          ready: true,
        },
      },
    ]);

    const filterBool = { ready: true };
    const resultsBool = await vectorStore.similaritySearch(
      query,
      1,
      filterBool
    );
    expect(resultsBool.length).toEqual(1);
    expect(resultsBool).toMatchObject([
      {
        pageContent: "foo",
        metadata: {
          start: 100,
          end: 150,
          docName: "foo.txt",
          quality: "bad",
          ready: true,
        },
      },
    ]);
  });

  test("test similarity search with score", async () => {
    const tableNameTest = "TEST_TABLE_SCORE";
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    await dropTable(client, tableNameTest);
    const texts = ["foo", "bar", "baz"];
    const vectorDB = await HanaDB.fromTexts(texts, {}, embeddings, args);

    const searchResult = await vectorDB.similaritySearchWithScore(texts[0], 3);
    expect(searchResult[0][0].pageContent).toEqual(texts[0]);
    expect(searchResult[0][1]).toEqual(1.0);
    expect(searchResult[1][1]).toBeLessThanOrEqual(searchResult[0][1]);
    expect(searchResult[2][1]).toBeLessThanOrEqual(searchResult[1][1]);
    expect(searchResult[2][1]).toBeGreaterThanOrEqual(0.0);
  });

  test("test similarity search with score with euclidian distance", async () => {
    const tableNameTest = "TEST_TABLE_SCORE_DISTANCE";
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
      distanceStrategy: "euclidean",
    };
    await dropTable(client, tableNameTest);
    const texts = ["foo", "bar", "baz"];
    const vectorDB = await HanaDB.fromTexts(texts, {}, embeddings, args);

    const searchResult = await vectorDB.similaritySearchWithScore(texts[0], 3);
    expect(searchResult[0][0].pageContent).toEqual(texts[0]);
    expect(searchResult[0][1]).toEqual(0.0);
    expect(searchResult[1][1]).toBeGreaterThanOrEqual(searchResult[0][1]);
    expect(searchResult[2][1]).toBeGreaterThanOrEqual(searchResult[1][1]);
  });

  test("test similarity search by vector", async () => {
    const tableNameTest = "TEST_TABLE_SEARCH_SIMPLE_VECTOR";
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    await dropTable(client, tableNameTest);
    const texts = ["foo", "bar", "baz"];
    const vectorDB = await HanaDB.fromTexts(texts, {}, embeddings, args);
    const vector = await embeddings.embedQuery(texts[0]);
    const searchResult = await vectorDB.similaritySearchVectorWithScore(
      vector,
      1
    );
    expect(searchResult[0][0].pageContent).toEqual(texts[0]);
    expect(texts[1]).not.toEqual(searchResult[0][0].pageContent);
  });
});

describe("Deletion tests", () => {
  test("test hanavector delete called wrong", async () => {
    const tableNameTest = "TEST_TABLE_DELETE_FILTER_WRONG";
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    const texts = ["foo", "foo", "fox"];
    await dropTable(client, tableNameTest);
    const vectorStore = await HanaDB.fromTexts(texts, {}, embeddings, args);
    let exceptionOccurred = false;
    try {
      await vectorStore.delete({});
    } catch (error) {
      exceptionOccurred = true;
      // console.log(error);
    }
    expect(exceptionOccurred).toBe(true);

    // Delete with ids parameter
    exceptionOccurred = false;
    try {
      await vectorStore.delete({
        ids: ["id1", "id"],
        filter: { start: 100, end: 200 },
      });
    } catch (error) {
      exceptionOccurred = true;
      // console.log(error);
    }
    expect(exceptionOccurred).toBe(true);
  });

  test("test delete documents with specific metadata", async () => {
    const tableNameTest = "DELETE_WITH_META";
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    // client.connect(connectionParams);
    const vectorStore = new HanaDB(embeddings, args);
    await dropTable(client, tableNameTest);
    await vectorStore.initialize();
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
    const filterTest = { end: 250 };
    await vectorStore.delete({ filter: filterTest });
    const sql = `SELECT COUNT(*) AS ROW_COUNT FROM "${args.tableName}" WHERE  JSON_VALUE(VEC_META, '$.quality') = ?`;
    const statement = await prepareQuery(client, sql);
    const result = await executeStatement(statement, ["good"]);
    expect(result[0].ROW_COUNT).toEqual(0);
  });

  test("test delete with empty filter", async () => {
    const tableNameTest = "TEST_DELETE_ALL";
    const texts = ["foo", "bar", "baz"];
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    // // client.connect(connectionParams);
    await dropTable(client, tableNameTest);
    const vectorStore = await HanaDB.fromTexts(texts, [], embeddings, args);
    const filterTest = {};
    await vectorStore.delete({ filter: filterTest });
    const sql = `SELECT COUNT(*) AS ROW_COUNT FROM "${args.tableName}"`;
    const result = await executeQuery(client, sql);
    expect(result[0].ROW_COUNT).toEqual(0);
  });
});

describe("Tests on HANA side", () => {
  test("hanavector non existing table", async () => {
    const tableNameTest = "NON_EXISTING";
    await dropTable(client, tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    const vectordb = new HanaDB(embeddings, args);
    await vectordb.initialize();
    expect(await vectordb.tableExists(tableNameTest)).toBe(true);
  });

  test("hanavector table with missing columns", async () => {
    const tableNameTest = "EXISTING_MISSING_COLS";

    // Drop the table if it exists and create a new one with a wrong column
    // try {
    await dropTable(client, tableNameTest);
    const sqlStr = `CREATE TABLE ${tableNameTest} (WRONG_COL NVARCHAR(500));`;
    await executeQuery(client, sqlStr);
    // } catch (error) {
    //   console.error("Error while setting up the table:", error);
    //   throw error;
    // }

    // Check if an error is raised when trying to create HanaDB instance
    let exceptionOccurred = false;
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    try {
      const vectordb = new HanaDB(embeddings, args);
      await vectordb.initialize();
    } catch (error) {
      // An Error is expected here
      // console.log(error);
      exceptionOccurred = true;
    }

    // Assert that an exception occurred
    expect(exceptionOccurred).toBe(true);
  });

  test("hanavector table with wrong typed columns", async () => {
    const tableNameTest = "EXISTING_WRONG_TYPES";
    const contentColumnTest = "DOC_TEXT";
    const metadataColumnTest = "DOC_META";
    const vectorColumnTest = "DOC_VECTOR";
    // Drop the table if it exists and create a new one with a wrong column
    await dropTable(client, tableNameTest);
    const sqlStr = `CREATE TABLE ${tableNameTest} (${contentColumnTest} INTEGER, 
        ${metadataColumnTest} INTEGER, ${vectorColumnTest} INTEGER);`;
    await executeQuery(client, sqlStr);

    // Check if an error is raised when trying to create HanaDB instance
    let exceptionOccurred = false;
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
      contentColumn: contentColumnTest,
      metadataColumn: metadataColumnTest,
      vectorColumn: vectorColumnTest,
    };
    try {
      const vectordb = new HanaDB(embeddings, args);
      await vectordb.initialize();
    } catch (error) {
      // An Error is expected here
      // console.log(error);
      exceptionOccurred = true;
    }

    // Assert that an exception occurred
    expect(exceptionOccurred).toBe(true);
  });

  test("hanavector non existing table fixed vector length", async () => {
    const tableNameTest = "NON_EXISTING";
    const vectorColumnTest = "MY_VECTOR";
    const vectorColumnLengthTest = 42;
    // Drop the table if it exists and create a new one with a wrong column
    await dropTable(client, tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
      vectorColumn: vectorColumnTest,
      vectorColumnLength: vectorColumnLengthTest,
    };
    const vectorStore = new HanaDB(embeddings, args);
    await vectorStore.initialize();
    expect(await vectorStore.tableExists(tableNameTest)).toBe(true);
    await vectorStore.checkColumn(
      tableNameTest,
      vectorColumnTest,
      "REAL_VECTOR",
      vectorColumnLengthTest
    );
  });

  test("test hanavector filter prepared statement params", async () => {
    const tableNameTest = "TEST_TABLE_FILTER_PARAM";
    // Delete table if it exists
    await dropTable(client, tableNameTest); // Assuming dropTable function is defined elsewhere
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    const docs: Document[] = [
      {
        pageContent: "foo",
        metadata: { start: 0, end: 100, quality: "good", ready: true },
      },
      {
        pageContent: "bar",
        metadata: { start: 100, end: 200, quality: "bad", ready: false },
      },
      {
        pageContent: "baz",
        metadata: { start: 200, end: 300, quality: "ugly", ready: true },
      },
    ];

    await HanaDB.fromDocuments(docs, embeddings, args);

    // Query for JSON_VALUE(VEC_META, '$.start') = '100'
    let sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.start') = '100'`;
    let result = await executeQuery(client, sqlStr);
    expect(result.length).toBe(1);
    // let stm = client.prepare(sqlStr);
    // let resultSet = stm.execQuery();
    // let rowCount = resultSet.getRowCount();
    // expect(rowCount).toBe(1);

    // Using prepared statement parameter for query_value = 100
    const queryValue1 = 100;
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.start') = ?`;
    // stm = client.prepare(sqlStr);
    // resultSet = stm.execQuery([queryValue1]);
    // rowCount = resultSet.getRowCount();
    // expect(rowCount).toBe(1);
    let stm = await prepareQuery(client, sqlStr);
    result = await executeStatement(stm, [queryValue1.toString()]);
    expect(result.length).toBe(1);

    // Query for JSON_VALUE(VEC_META, '$.quality') = 'good'
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.quality') = 'good'`;
    // stm = client.prepare(sqlStr);
    // resultSet = stm.execQuery();
    // rowCount = resultSet.getRowCount();
    // expect(rowCount).toBe(1);
    result = await executeQuery(client, sqlStr);
    expect(result.length).toBe(1);

    // Using prepared statement parameter for query_value = "good"
    const queryValue2 = "good";
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.quality') = ?`;
    stm = await prepareQuery(client, sqlStr);
    result = await executeStatement(stm, [queryValue2]);
    expect(result.length).toBe(1);

    // Query for JSON_VALUE(VEC_META, '$.ready') = false
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.ready') = false`;
    result = await executeQuery(client, sqlStr);
    expect(result.length).toBe(1);

    // Using prepared statement parameter for query_value = "true"
    const queryValue3 = "true";
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.ready') = ?`;
    stm = await prepareQuery(client, sqlStr);
    result = await executeStatement(stm, [queryValue3]);
    expect(result.length).toBe(2);

    // Using prepared statement parameter for query_value = "false"
    const queryValue4 = "false";
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.ready') = ?`;
    stm = await prepareQuery(client, sqlStr);
    result = await executeStatement(stm, [queryValue4]);
    expect(result.length).toBe(1);
  });

  test("test hanavector table mixed case names", async () => {
    const tableNameTest = "MyTableName";
    const contentColumnTest = "TextColumn";
    const metadataColumnTest = "MetaColumn";
    const vectorColumnTest = "VectorColumn";
    await dropTable(client, tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
      metadataColumn: metadataColumnTest,
      contentColumn: contentColumnTest,
      vectorColumn: vectorColumnTest,
    };
    const texts = ["foo", "foo", "fox"];
    await HanaDB.fromTexts(texts, [], embeddings, args);
    // Check that embeddings have been created in the table
    const numberOfTexts = texts.length;
    const sqlStr = `SELECT COUNT(*) AS COUNT FROM "${tableNameTest}"`;
    const result = await executeQuery(client, sqlStr);
    expect(result[0].COUNT).toBe(numberOfTexts);
    // const stm = client.prepare(sqlStr);
    // const resultSet = stm.execQuery();
    // while (resultSet.next()) {
    //   numberOfRows = resultSet.getValue(0);
    //   expect(numberOfRows).toBe(numberOfTexts);
    // }
  });

  test("test invalid metadata keys", async () => {
    const tableNameTest = "TEST_TABLE_INVALID_METADATA";
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    await dropTable(client, tableNameTest);
    const invalidMetadatas1 = [
      { "sta rt": 0, end: 100, quality: "good", ready: true },
    ];
    let exceptionOccurred = false;
    try {
      await HanaDB.fromTexts(
        ["foo", "bar", "baz"],
        invalidMetadatas1,
        embeddings,
        args
      );
    } catch (error) {
      // console.log(error);
      exceptionOccurred = true;
    }
    expect(exceptionOccurred).toBe(true);

    const invalidMetadatas2 = [
      { "sta/nrt": 0, end: 100, quality: "good", ready: true },
    ];

    exceptionOccurred = false;
    try {
      await HanaDB.fromTexts(
        ["foo", "bar", "baz"],
        invalidMetadatas2,
        embeddings,
        args
      );
    } catch (error) {
      // console.log(error);
      exceptionOccurred = true;
    }
    expect(exceptionOccurred).toBe(true);
  });

  test("test hanavector similarity search with metadata filter invalid type", async () => {
    const tableNameTest = "TEST_TABLE_FILTER_INVALID_TYPE";
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    await dropTable(client, tableNameTest);
    let exceptionOccurred = false;
    const vector = await HanaDB.fromTexts(
      ["foo", "bar", "baz"],
      {},
      embeddings,
      args
    );
    try {
      await vector.similaritySearch("foo", 3, { wrong_type: 0.1 });
    } catch (error) {
      // console.log(error);
      exceptionOccurred = true;
    }
    expect(exceptionOccurred).toBe(true);
  });
});

describe("HNSW Index Creation Tests", () => {
  test("test HNSW index creation with default values", async () => {
    /**
     * Description:
     * This test verifies that the HNSW index can be successfully created with default values
     * when no parameters are passed to the createHnswIndex function.
     */
    const tableNameTest = "TEST_TABLE_HNSW_DEFAULT";
    const args = {
      connection: client,
      tableName: tableNameTest,
    };

    // Cleanup: Drop table if exists
    await dropTable(client, tableNameTest);

    // Create HanaDB instance and add data
    const vector = await HanaDB.fromTexts(
      ["foo", "bar", "baz"],
      {},
      embeddings,
      args
    );

    let exceptionOccurred = false;
    try {
      // Call the createHnswIndex function with no parameters (default values)
      await vector.createHnswIndex();
    } catch (error) {
      console.log(error);
      exceptionOccurred = true;
    }

    // Assert that no exception occurred
    expect(exceptionOccurred).toBe(false);
  });

  test("test HNSW index creation with specific values", async () => {
    /**
     * Description:
     * This test verifies that the HNSW index can be created with specific values for m, efConstruction,
     * efSearch, and a custom indexName.
     */
    const tableNameTest = "TEST_TABLE_HNSW_DEFINED";
    const args = {
      connection: client,
      tableName: tableNameTest,
    };

    // Cleanup: Drop table if exists
    await dropTable(client, tableNameTest);

    // Create HanaDB instance and add data
    const vector = await HanaDB.fromTexts(
      ["foo", "bar", "baz"],
      {},
      embeddings,
      args
    );

    let exceptionOccurred = false;
    try {
      // Call the createHnswIndex function with specific values
      await vector.createHnswIndex({
        m: 50,
        efConstruction: 150,
        efSearch: 300,
        indexName: "custom_index",
      });
    } catch (error) {
      console.log(error);
      exceptionOccurred = true;
    }

    // Assert that no exception occurred
    expect(exceptionOccurred).toBe(false);
  });

  test("test HNSW index creation after initialization", async () => {
    const tableNameTest = "TEST_TABLE_HNSW_INDEX_AFTER_INIT";

    // Clean up: drop the table if it exists
    await dropTable(client, tableNameTest);
    const args = {
      connection: client,
      tableName: tableNameTest,
    };
    // Initialize HanaDB without adding documents yet
    const vectorDB = new HanaDB(embeddings, args);
    await vectorDB.initialize();
    expect(vectorDB).toBeDefined();
    // Create HNSW index before adding any documents
    await vectorDB.createHnswIndex({
      indexName: "index_pre_add",
      efSearch: 400,
      m: 50,
      efConstruction: 150,
    });

    // Add texts after index creation
    await vectorDB.addDocuments([
      {
        pageContent: "Bye bye",
        metadata: { id: 2, name: "2" },
      },
      {
        pageContent: "Hello world",
        metadata: { id: 1, name: "1" },
      },
      {
        pageContent: "hello nice world",
        metadata: { id: 3, name: "3" },
      },
    ]);

    const results = await vectorDB.similaritySearch("Hello world", 1);
    expect(results).toHaveLength(1);
    expect(results).toEqual([
      new Document({
        pageContent: "Hello world",
        metadata: { id: 1, name: "1" },
      }),
    ]);
  });

  test("test duplicate HNSW index creation", async () => {
    const tableNameTest = "TEST_TABLE_HNSW_DUPLICATE_INDEX";
    const args = {
      connection: client,
      tableName: tableNameTest,
    };
    // Clean up: drop the table if it exists
    await dropTable(client, tableNameTest);

    // Create HanaDB instance and add data
    const vectorDB = await HanaDB.fromTexts(
      ["foo", "bar", "baz"],
      {},
      embeddings,
      args
    );

    // Create HNSW index for the first time
    await vectorDB.createHnswIndex({
      indexName: "index_cosine",
      efSearch: 300,
      m: 80,
      efConstruction: 100,
    });

    // Trying to create the same index again should raise an exception
    await expect(
      vectorDB.createHnswIndex({
        efSearch: 300,
        m: 80,
        efConstruction: 100,
      })
    ).rejects.toThrow();
  });

  test("test HNSW index creation with invalid m value", async () => {
    /**
     * Description:
     * This test ensures that the HNSW index creation throws an error when an invalid value for m is passed
     * (e.g., m < 4 or m > 1000).
     */
    const tableNameTest = "TEST_TABLE_HNSW_INVALID_M";
    const args = {
      connection: client,
      tableName: tableNameTest,
    };

    // Cleanup: Drop table if exists
    await dropTable(client, tableNameTest);

    // Create HanaDB instance and add data
    const vector = await HanaDB.fromTexts(
      ["foo", "bar", "baz"],
      {},
      embeddings,
      args
    );

    let exceptionOccurred = false;
    try {
      // Call the createHnswIndex function with invalid m value
      await vector.createHnswIndex({
        m: 2, // Invalid value for m (should be >= 4)
      });
    } catch (error) {
      exceptionOccurred = true;
    }

    // Assert that exception occurred
    expect(exceptionOccurred).toBe(true);
  });

  test("test HNSW index creation with invalid efConstruction value", async () => {
    /**
     * Description:
     * This test ensures that the HNSW index creation throws an error when an invalid efConstruction value is passed
     * (e.g., efConstruction > 100000).
     */
    const tableNameTest = "TEST_TABLE_HNSW_INVALID_EF_CONSTRUCTION";
    const args = {
      connection: client,
      tableName: tableNameTest,
    };

    // Cleanup: Drop table if exists
    await dropTable(client, tableNameTest);

    // Create HanaDB instance and add data
    const vector = await HanaDB.fromTexts(
      ["foo", "bar", "baz"],
      {},
      embeddings,
      args
    );

    let exceptionOccurred = false;
    try {
      // Call the createHnswIndex function with invalid efConstruction value
      await vector.createHnswIndex({
        efConstruction: 100001, // Invalid value for efConstruction (should be <= 100000)
      });
    } catch (error) {
      exceptionOccurred = true;
    }

    // Assert that exception occurred
    expect(exceptionOccurred).toBe(true);
  });

  test("test HNSW index creation with invalid efSearch value", async () => {
    /**
     * Description:
     * This test ensures that the HNSW index creation throws an error when an invalid efSearch value is passed
     * (e.g., efSearch < 1 or efSearch > 100000).
     */
    const tableNameTest = "TEST_TABLE_HNSW_INVALID_EF_SEARCH";
    const args = {
      connection: client,
      tableName: tableNameTest,
    };

    // Cleanup: Drop table if exists
    await dropTable(client, tableNameTest);

    // Create HanaDB instance and add data
    const vector = await HanaDB.fromTexts(
      ["foo", "bar", "baz"],
      {},
      embeddings,
      args
    );

    let exceptionOccurred = false;
    try {
      // Call the createHnswIndex function with invalid efSearch value
      await vector.createHnswIndex({
        efSearch: 0, // Invalid value for efSearch (should be >= 1)
      });
    } catch (error) {
      exceptionOccurred = true;
    }

    // Assert that exception occurred
    expect(exceptionOccurred).toBe(true);
  });
});

describe("Filter Tests", () => {
  // Filter Test 1: Applying various filters from TYPE_1_FILTERING_TEST_CASES
  it.each(TYPE_1_FILTERING_TEST_CASES)(
    "should apply type 1 filtering correctly with filter %j",
    async (testCase) => {
      const { filter, expected } = testCase;
      const tableNameTest = "TEST_TABLE_ENHANCED_FILTER_1";
      const args = {
        connection: client,
        tableName: tableNameTest,
      };
      await dropTable(client, tableNameTest);

      // Initialize the HanaDB instance
      const vectorDB = new HanaDB(embeddings, args);
      await vectorDB.initialize();
      expect(vectorDB).toBeDefined();

      // Add documents to the database
      await vectorDB.addDocuments(DOCUMENTS);

      // Perform a similarity search with the filter
      const docs = await vectorDB.similaritySearch("Foo", 5, filter);
      const ids = docs.map((doc) => doc.metadata.id);

      // Check if the returned document IDs match the expected IDs
      expect(ids.length).toBe(expected.length);
      expect(ids.every((id) => expected.includes(id))).toBe(true);
    }
  );

  // Filter Test 2: Testing TYPE_2_FILTERING_TEST_CASES
  it.each(TYPE_2_FILTERING_TEST_CASES)(
    "should apply type 2 filtering correctly with filter %j",
    async (testCase) => {
      const { filter, expected } = testCase;
      const tableNameTest = "TEST_TABLE_ENHANCED_FILTER_2";
      const args = {
        connection: client,
        tableName: tableNameTest,
      };
      await dropTable(client, tableNameTest);

      // Initialize the HanaDB instance
      const vectorDB = new HanaDB(embeddings, args);
      await vectorDB.initialize();
      expect(vectorDB).toBeDefined();

      // Add documents to the database
      await vectorDB.addDocuments(DOCUMENTS);

      // Perform a similarity search with the filter
      const docs = await vectorDB.similaritySearch("Foo", 5, filter);
      const ids = docs.map((doc) => doc.metadata.id);

      // Check if the returned document IDs match the expected IDs
      expect(ids.length).toBe(expected.length);
      expect(ids.every((id) => expected.includes(id))).toBe(true);
    }
  );

  // Filter Test 3: Testing TYPE_3_FILTERING_TEST_CASES
  it.each(TYPE_3_FILTERING_TEST_CASES)(
    "should apply type 3 filtering correctly with filter %j",
    async (testCase) => {
      const { filter, expected } = testCase;
      const tableNameTest = "TEST_TABLE_ENHANCED_FILTER_3";
      const args = {
        connection: client,
        tableName: tableNameTest,
      };
      await dropTable(client, tableNameTest);

      // Initialize the HanaDB instance
      const vectorDB = new HanaDB(embeddings, args);
      await vectorDB.initialize();
      expect(vectorDB).toBeDefined();

      // Add documents to the database
      await vectorDB.addDocuments(DOCUMENTS);

      // Perform a similarity search with the filter
      const docs = await vectorDB.similaritySearch("Foo", 5, filter);
      const ids = docs.map((doc) => doc.metadata.id);

      // Check if the returned document IDs match the expected IDs
      expect(ids.length).toBe(expected.length);
      expect(ids.every((id) => expected.includes(id))).toBe(true);
    }
  );

  // Filter Test 4: Testing TYPE_4_FILTERING_TEST_CASES
  it.each(TYPE_4_FILTERING_TEST_CASES)(
    "should apply type 4 filtering correctly with filter %j",
    async (testCase) => {
      const { filter, expected } = testCase;
      const tableNameTest = "TEST_TABLE_ENHANCED_FILTER_4";
      const args = {
        connection: client,
        tableName: tableNameTest,
      };
      await dropTable(client, tableNameTest);

      // Initialize the HanaDB instance
      const vectorDB = new HanaDB(embeddings, args);
      await vectorDB.initialize();
      expect(vectorDB).toBeDefined();

      // Add documents to the database
      await vectorDB.addDocuments(DOCUMENTS);

      // Perform a similarity search with the filter
      const docs = await vectorDB.similaritySearch("Foo", 5, filter);
      const ids = docs.map((doc) => doc.metadata.id);

      // Check if the returned document IDs match the expected IDs
      expect(ids.length).toBe(expected.length);
      expect(ids.every((id) => expected.includes(id))).toBe(true);
    }
  );

  // Filter Test 5: Testing TYPE_4_FILTERING_TEST_CASES
  it.each(TYPE_5_FILTERING_TEST_CASES)(
    "should apply type 5 filtering correctly with filter %j",
    async (testCase) => {
      const { filter, expected } = testCase;
      const tableNameTest = "TEST_TABLE_ENHANCED_FILTER_5";
      const args = {
        connection: client,
        tableName: tableNameTest,
      };
      await dropTable(client, tableNameTest);

      // Initialize the HanaDB instance
      const vectorDB = new HanaDB(embeddings, args);
      await vectorDB.initialize();
      expect(vectorDB).toBeDefined();

      // Add documents to the database
      await vectorDB.addDocuments(DOCUMENTS);

      // Perform a similarity search with the filter
      const docs = await vectorDB.similaritySearch("Foo", 5, filter);
      const ids = docs.map((doc) => doc.metadata.id);

      // Check if the returned document IDs match the expected IDs
      expect(ids.length).toBe(expected.length);
      expect(ids.every((id) => expected.includes(id))).toBe(true);
    }
  );

  // Filter Test 6: Testing TYPE_6_FILTERING_TEST_CASES
  it.each(TYPE_6_FILTERING_TEST_CASES)(
    "should apply type 6 filtering correctly with filter %j",
    async (testCase) => {
      const { filter, expected } = testCase;
      const tableNameTest = "TEST_TABLE_ENHANCED_FILTER_6";
      const args = {
        connection: client,
        tableName: tableNameTest,
      };
      await dropTable(client, tableNameTest);

      // Initialize the HanaDB instance
      const vectorDB = new HanaDB(embeddings, args);
      await vectorDB.initialize();
      expect(vectorDB).toBeDefined();

      // Add documents to the database
      await vectorDB.addDocuments(DOCUMENTS);

      // Perform a similarity search with the filter
      const docs = await vectorDB.similaritySearch("Foo", 5, filter);
      console.log(docs);
      const ids = docs.map((doc) => doc.metadata.id);

      // Check if the returned document IDs match the expected IDs
      expect(ids.length).toBe(expected.length);
      expect(ids.every((id) => expected.includes(id))).toBe(true);
    }
  );
});
