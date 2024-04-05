/* eslint-disable no-process-env */
import hanaClient from "@sap/hana-client";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { test, expect } from "@jest/globals";
import { HanaDB, HanaDBArgs } from "../hanavector.js";

// Connection parameters
const connectionParams = {
  host: process.env.HANA_HOST,
  port: process.env.HANA_PORT,
  uid: process.env.HANA_UID,
  pwd: process.env.HANA_PWD,
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

const client = hanaClient.createConnection();
client.connect(connectionParams);

beforeAll(async () => {
  expect(process.env.HANA_HOST).toBeDefined();
  expect(process.env.HANA_PORT).toBeDefined();
  expect(process.env.HANA_UID).toBeDefined();
  expect(process.env.HANA_PWD).toBeDefined();
});

afterAll(async () => {
  client.disconnect();
});

function dropTable(tableName: string) {
  try {
    const query = `DROP TABLE "${tableName}"`;
    client.exec(query);
    // console.log(`Table ${tableName} dropped successfully.`);
  } catch (error) {
    // console.error(`Error dropping table ${tableName}:`, error);
  }
}

describe.skip("add documents and similarity search tests", () => {
  test("test fromText and default similarity search", async () => {
    const tableNameTest = "TEST_ADD_TEXT";
    dropTable(tableNameTest);
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
    dropTable(tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    const vectorStore = new HanaDB(embeddings, args);
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
    expect(vectorStore.tableExists(tableNameTest)).toBe(true);
  });

  test("performs addDocument and user defined similarity search", async () => {
    const tableNameTest = "TEST_ADD_DOC";
    dropTable(tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
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
      "Sandwiches taste good.",
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

  test("performs max marginal relevance search", async () => {
    const tableNameTest = "TEST_MRR";
    dropTable(tableNameTest);
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
    dropTable(tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    // client.connect(connectionParams);
    const vectorStore = new HanaDB(embeddings, args);
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
    dropTable(tableNameTest);
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
    dropTable(tableNameTest);
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
    dropTable(tableNameTest);
    const texts = ["foo", "bar", "baz"];
    const vectorDB = await HanaDB.fromTexts(texts, {}, embeddings, args);
    const vector = await embeddings.embedQuery(texts[0]);
    const searchResult = await vectorDB.similaritySearchVectorWithScore(
      vector,
      1
    );
    console.log(searchResult);
    expect(searchResult[0][0].pageContent).toEqual(texts[0]);
    expect(texts[1]).not.toEqual(searchResult[0][0].pageContent);
  });
});

describe.skip("Deletion tests", () => {
  test("test hanavector delete called wrong", async () => {
    const tableNameTest = "TEST_TABLE_DELETE_FILTER_WRONG";
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    dropTable(tableNameTest);
    const texts = ["foo", "foo", "fox"];
    const vectorStore = await HanaDB.fromTexts(texts, {}, embeddings, args);

    // Delete without filter parameter
    let exceptionOccurred = false;
    try {
      await vectorStore.delete({});
    } catch (error) {
      exceptionOccurred = true;
      console.log(error);
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
      console.log(error);
    }
    expect(exceptionOccurred).toBe(true);
  });

  test("test delete documents with specific metadata", async () => {
    const tableNameTest = "DELETE_WITH_META";
    dropTable(tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
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
    const filterTest = { quality: "good" };
    await vectorStore.delete({ filter: filterTest });
    const sql = `SELECT COUNT(*) AS row_count FROM "${args.tableName}" WHERE  JSON_VALUE(VEC_META, '$.quality') = 'good'`;
    const stm = client.prepare(sql);
    const resultSet = stm.execQuery();
    while (resultSet.next()) {
      const result = resultSet.getValue(0);
      expect(result).toEqual(0);
    }
  });

  test("test delete with empty filter", async () => {
    const tableNameTest = "TEST_DELETE_ALL";
    const texts = ["foo", "bar", "baz"];
    dropTable(tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    // // client.connect(connectionParams);
    const vectorStore = await HanaDB.fromTexts(texts, [], embeddings, args);
    const filterTest = {};
    await vectorStore.delete({ filter: filterTest });
    const sql = `SELECT COUNT(*) AS row_count FROM "${args.tableName}"`;
    const stm = client.prepare(sql);
    const resultSet = stm.execQuery();
    while (resultSet.next()) {
      const result = resultSet.getValue(0);
      expect(result).toEqual(0);
    }
  });
});

describe.skip("Tests on HANA side", () => {
  test("hanavector non existing table", () => {
    const tableNameTest = "NON_EXISTING";
    dropTable(tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    const vectordb = new HanaDB(embeddings, args);
    expect(vectordb.tableExists(tableNameTest)).toBe(true);
  });

  test("hanavector table with missing columns", () => {
    const tableNameTest = "EXISTING_MISSING_COLS";

    // Drop the table if it exists and create a new one with a wrong column
    // try {
    dropTable(tableNameTest);
    const sqlStr = `CREATE TABLE ${tableNameTest} (WRONG_COL NVARCHAR(500));`;
    client.execute(sqlStr);
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
      // eslint-disable-next-line no-new
      new HanaDB(embeddings, args);
    } catch (error) {
      // An Error is expected here
      console.log(error);
      exceptionOccurred = true;
    }

    // Assert that an exception occurred
    expect(exceptionOccurred).toBe(true);
  });

  test("hanavector table with wrong typed columns", () => {
    const tableNameTest = "EXISTING_WRONG_TYPES";
    const contentColumnTest = "DOC_TEXT";
    const metadataColumnTest = "DOC_META";
    const vectorColumnTest = "DOC_VECTOR";
    // Drop the table if it exists and create a new one with a wrong column
    try {
      dropTable(tableNameTest);
      const sqlStr = `CREATE TABLE ${tableNameTest} (${contentColumnTest} INTEGER, 
        ${metadataColumnTest} INTEGER, ${vectorColumnTest} INTEGER);`;
      client.execute(sqlStr);
    } catch (error) {
      console.error("Error while setting up the table:", error);
      throw error;
    }

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
      // eslint-disable-next-line no-new
      new HanaDB(embeddings, args);
    } catch (error) {
      // An Error is expected here
      console.log(error);
      exceptionOccurred = true;
    }

    // Assert that an exception occurred
    expect(exceptionOccurred).toBe(true);
  });

  test("hanavector non existing table fixed vector length", () => {
    const tableNameTest = "NON_EXISTING";
    const vectorColumnTest = "MY_VECTOR";
    const vectorColumnLengthTest = 42;
    // Drop the table if it exists and create a new one with a wrong column
    dropTable(tableNameTest);
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
      vectorColumn: vectorColumnTest,
      vectorColumnLength: vectorColumnLengthTest,
    };
    const vectorStore = new HanaDB(embeddings, args);
    expect(vectorStore.tableExists(tableNameTest)).toBe(true);
    vectorStore.checkColumn(
      tableNameTest,
      vectorColumnTest,
      "REAL_VECTOR",
      vectorColumnLengthTest
    );
  });

  test("test hanavector filter prepared statement params", async () => {
    const tableNameTest = "TEST_TABLE_FILTER_PARAM";
    // Delete table if it exists
    dropTable(tableNameTest); // Assuming dropTable function is defined elsewhere
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
    let stm = client.prepare(sqlStr);
    let resultSet = stm.execQuery();
    let rowCount = resultSet.getRowCount();
    expect(rowCount).toBe(1);

    // Using prepared statement parameter for query_value = 100
    const queryValue1 = 100;
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.start') = ?`;
    stm = client.prepare(sqlStr);
    resultSet = stm.execQuery([queryValue1]);
    rowCount = resultSet.getRowCount();
    expect(rowCount).toBe(1);

    // Query for JSON_VALUE(VEC_META, '$.quality') = 'good'
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.quality') = 'good'`;
    stm = client.prepare(sqlStr);
    resultSet = stm.execQuery();
    rowCount = resultSet.getRowCount();
    expect(rowCount).toBe(1);

    // Using prepared statement parameter for query_value = "good"
    const queryValue2 = "good";
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.quality') = ?`;
    stm = client.prepare(sqlStr);
    resultSet = stm.execQuery([queryValue2]);
    rowCount = resultSet.getRowCount();
    expect(rowCount).toBe(1);

    // Query for JSON_VALUE(VEC_META, '$.ready') = false
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.ready') = false`;
    stm = client.prepare(sqlStr);
    resultSet = stm.execQuery();
    rowCount = resultSet.getRowCount();
    expect(rowCount).toBe(1);

    // Using prepared statement parameter for query_value = "true"
    const queryValue3 = "true";
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.ready') = ?`;
    stm = client.prepare(sqlStr);
    resultSet = stm.execQuery([queryValue3]);
    rowCount = resultSet.getRowCount();
    expect(rowCount).toBe(2);

    // Using prepared statement parameter for query_value = "false"
    const queryValue4 = "false";
    sqlStr = `SELECT * FROM ${tableNameTest} WHERE JSON_VALUE(VEC_META, '$.ready') = ?`;
    stm = client.prepare(sqlStr);
    resultSet = stm.execQuery([queryValue4]);
    rowCount = resultSet.getRowCount();
    expect(rowCount).toBe(1);
  });

  test("test hanavector table mixed case names", async () => {
    const tableNameTest = "MyTableName";
    const contentColumnTest = "TextColumn";
    const metadataColumnTest = "MetaColumn";
    const vectorColumnTest = "VectorColumn";
    dropTable(tableNameTest);
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
    let numberOfRows = -1;
    const sqlStr = `SELECT COUNT(*) FROM "${tableNameTest}"`;
    const stm = client.prepare(sqlStr);
    const resultSet = stm.execQuery();
    while (resultSet.next()) {
      numberOfRows = resultSet.getValue(0);
      expect(numberOfRows).toBe(numberOfTexts);
    }
  });

  test("test invalid metadata keys", async () => {
    const tableNameTest = "TEST_TABLE_INVALID_METADATA";
    const args: HanaDBArgs = {
      connection: client,
      tableName: tableNameTest,
    };
    dropTable(tableNameTest);
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
      console.log(error);
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
      console.log(error);
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
    dropTable(tableNameTest);
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
      console.log(error);
      exceptionOccurred = true;
    }
    expect(exceptionOccurred).toBe(true);
  });
});
