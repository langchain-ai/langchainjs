/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
import hdbClient from "hdb";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { test, expect } from "@jest/globals";
import { HanaDB, HanaDBArgs } from "../../hanavector.js";
import {
  FILTERING_DOCUMENTS,
  FILTERING_TEST_CASES,
} from "./hanavector.fixtures.js";
import { HanaTestUtils } from "./hanavector.test.utils.js";
import {
  DOCUMENTS,
  METADATAS,
  TABLE_NAME,
  TEXTS,
} from "./hanavector.test.constants.js";
import {
  executeQuery,
  executeStatement,
  prepareQuery,
} from "../../../utils/hanautils.js";
// Connection parameters
const connectionParams = {
  host: process.env.HANA_DB_ADDRESS,
  port: process.env.HANA_DB_PORT,
  user: process.env.HANA_DB_USER,
  password: process.env.HANA_DB_PASSWORD,
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

class Config {
  client: any;

  schemaName: string;

  constructor(client: any, schemaName: string) {
    this.client = client;
    this.schemaName = schemaName;
  }
}

let config: Config;

beforeAll(async () => {
  expect(process.env.HANA_DB_ADDRESS).toBeDefined();
  expect(process.env.HANA_DB_PORT).toBeDefined();
  expect(process.env.HANA_DB_USER).toBeDefined();
  expect(process.env.HANA_DB_PASSWORD).toBeDefined();
  const client = hdbClient.createClient(connectionParams);
  const schemaPrefix = "LANGCHAIN_TEST";
  await HanaTestUtils.connectToHANA(client);
  await HanaTestUtils.dropOldTestSchemas(client, schemaPrefix);
  config = new Config(
    client,
    await HanaTestUtils.generateSchemaName(client, schemaPrefix)
  );
  await HanaTestUtils.createAndSetSchema(config.client, config.schemaName);
});

afterAll(async () => {
  await HanaTestUtils.dropSchemaIfExists(config.client, config.schemaName);
  config.client.disconnect();
});

let vectorDB: HanaDB;

beforeEach(async () => {
  const args: HanaDBArgs = {
    connection: config.client,
    tableName: TABLE_NAME,
  };
  vectorDB = new HanaDB(embeddings, args);
  expect(vectorDB).toBeDefined();
  await vectorDB.initialize();
});

afterEach(async () => {
  await HanaTestUtils.dropTable(config.client, TABLE_NAME);
});

describe("Tests on HANA Side", () => {
  test("test hanavector table exists after initialisation", async () => {
    const exists = await vectorDB.tableExists(TABLE_NAME);
    expect(exists).toBe(true);
  });

  test("test hanavector table with missing columns", async () => {
    const tableName = "EXISTING_MISSING_COLS";
    await executeQuery(
      config.client,
      `CREATE TABLE ${tableName} (WRONG_COL NVARCHAR(500));`
    );
    const args: HanaDBArgs = {
      connection: config.client,
      tableName,
    };
    const vectorDB = new HanaDB(embeddings, args);
    await expect(vectorDB.initialize()).rejects.toThrow();
  });

  test("hanavector table with nvarchar content", async () => {
    const tableName = "EXISTING_NVARCHAR";
    const contentColumn = "TEST_TEXT";
    const metadataColumn = "TEST_META";
    const vectorColumn = "TEST_VECTOR";

    const createTableSQL = `
      CREATE TABLE ${tableName}(
        ${contentColumn} NVARCHAR(2048),
        ${metadataColumn} NVARCHAR(2048),
        ${vectorColumn} REAL_VECTOR
      );
    `;

    await executeQuery(config.client, createTableSQL);

    const args: HanaDBArgs = {
      connection: config.client,
      tableName,
      contentColumn,
      metadataColumn,
      vectorColumn,
    };
    await HanaDB.fromTexts(TEXTS, METADATAS, embeddings, args);

    // Check that embeddings have been created in the table
    const numberOfTexts = TEXTS.length;
    const countResult = await executeQuery(
      config.client,
      `SELECT COUNT(*) AS COUNT FROM ${tableName}`
    );

    const numberOfRows = countResult[0]?.COUNT ?? -1;

    expect(numberOfRows).toBe(numberOfTexts);
  });

  test("hanavector table with wrong typed columns", async () => {
    const tableName = "EXISTING_WRONG_TYPES";
    const contentColumn = "DOC_TEXT";
    const metadataColumn = "DOC_META";
    const vectorColumn = "DOC_VECTOR";

    const createTableSQL = `
      CREATE TABLE ${tableName} (
        ${contentColumn} INTEGER,
        ${metadataColumn} INTEGER,
        ${vectorColumn} INTEGER
      );
    `;
    await executeQuery(config.client, createTableSQL);

    const args: HanaDBArgs = {
      connection: config.client,
      tableName,
      contentColumn,
      metadataColumn,
      vectorColumn,
    };

    await expect(async () => {
      vectorDB = new HanaDB(embeddings, args);
      await vectorDB.initialize();
    }).rejects.toThrow();
  });

  test("hanavector non-existing table with fixed vector length", async () => {
    const tableName = "NON_EXISTING_FIXED_VECTOR_LENGTH";
    const vectorColumn = "MY_VECTOR";
    const vectorColumnLength = 42;

    vectorDB = new HanaDB(embeddings, {
      connection: config.client,
      tableName,
      vectorColumn,
      vectorColumnLength,
    });

    await vectorDB.initialize();

    const exists = await vectorDB.tableExists(tableName);
    expect(exists).toBe(true);

    await vectorDB.checkColumn(
      tableName,
      vectorColumn,
      "REAL_VECTOR",
      vectorColumnLength
    );
  });

  test("hanavector prepared statement params", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    let sqlStr = `SELECT * FROM ${TABLE_NAME} WHERE JSON_VALUE(VEC_META, '$.start') = '100'`;
    let res = await executeQuery(config.client, sqlStr);
    expect(res.length).toBe(1);

    const queryValueNumber = 100;
    sqlStr = `SELECT * FROM ${TABLE_NAME} WHERE JSON_VALUE(VEC_META, '$.start') = ?`;
    let stm = await prepareQuery(config.client, sqlStr);
    res = await executeStatement(stm, [queryValueNumber.toString()]);
    expect(res.length).toBe(1);

    sqlStr = `SELECT * FROM ${TABLE_NAME} WHERE JSON_VALUE(VEC_META, '$.quality') = 'good'`;
    res = await executeQuery(config.client, sqlStr);
    expect(res.length).toBe(1);

    const queryValueString = "good";
    sqlStr = `SELECT * FROM ${TABLE_NAME} WHERE JSON_VALUE(VEC_META, '$.quality') = ?`;
    stm = await prepareQuery(config.client, sqlStr);
    res = await executeStatement(stm, [queryValueString]);
    expect(res.length).toBe(1);

    sqlStr = `SELECT * FROM ${TABLE_NAME} WHERE JSON_VALUE(VEC_META, '$.ready') = false`;
    res = await executeQuery(config.client, sqlStr);
    expect(res.length).toBe(1);

    let queryValueBool = "true";
    sqlStr = `SELECT * FROM ${TABLE_NAME} WHERE JSON_VALUE(VEC_META, '$.ready') = ?`;
    stm = await prepareQuery(config.client, sqlStr);
    res = await executeStatement(stm, [queryValueBool]);
    expect(res.length).toBe(3);

    queryValueBool = "false";
    sqlStr = `SELECT * FROM ${TABLE_NAME} WHERE JSON_VALUE(VEC_META, '$.ready') = ?`;
    stm = await prepareQuery(config.client, sqlStr);
    res = await executeStatement(stm, [queryValueBool]);
    expect(res.length).toBe(1);
  });

  test("hanavector invalid metadata keys", async () => {
    const tableName = "TEST_TABLE_INVALID_METADATA";

    const invalidMetadatas1 = [
      { "sta rt": 0, end: 100, quality: "good", ready: true },
    ];

    await expect(
      HanaDB.fromTexts(TEXTS, invalidMetadatas1, embeddings, {
        connection: config.client,
        tableName,
      })
    ).rejects.toThrow();

    const invalidMetadatas2 = [
      { "sta/nrt": 0, end: 100, quality: "good", ready: true },
    ];

    await expect(
      HanaDB.fromTexts(TEXTS, invalidMetadatas2, embeddings, {
        connection: config.client,
        tableName,
      })
    ).rejects.toThrow();
  });

  test("hanavector table with mixed case names", async () => {
    const tableName = "MyTableName";
    const contentColumn = "TextColumn";
    const metadataColumn = "MetaColumn";
    const vectorColumn = "VectorColumn";

    const vectorDB = new HanaDB(embeddings, {
      connection: config.client,
      distanceStrategy: "COSINE",
      tableName,
      contentColumn,
      metadataColumn,
      vectorColumn,
    });
    await vectorDB.initialize();

    await vectorDB.addDocuments(DOCUMENTS);

    const numberOfTexts = TEXTS.length;

    const sqlStr = `SELECT COUNT(*) AS COUNT FROM "${tableName}"`;
    const res = await executeQuery(config.client, sqlStr);

    expect(res[0].COUNT).toBe(numberOfTexts);

    const results = await vectorDB.similaritySearch(TEXTS[0], 1);
    expect(results[0].pageContent).toBe(TEXTS[0]);
  });

  describe("hanavector metadata filtering tests", () => {
    beforeEach(async () => {
      // Clear table before each test
      await vectorDB.delete({ filter: {} });
      await vectorDB.addDocuments(FILTERING_DOCUMENTS);
    });

    test.each(FILTERING_TEST_CASES)(
      "filter: %o, matchingIds: %o",
      async (
        testFilter,
        matchingIds,
        _expectedWhereClause: string,
        _expectedWhereClauseParams
      ) => {
        const results = await vectorDB.similaritySearch("meow", 5, testFilter);
        const returnedIds = results.map((doc) => doc.metadata?.id);

        expect(returnedIds.sort()).toEqual(matchingIds.sort());
      }
    );
  });

  describe("specific metadata columns test", () => {
    test("test preexisting columns for metadata fill", async () => {
      const tableName = "PREEXISTING_FILTER_COLUMNS";
      const sqlStr = `
        CREATE TABLE "${tableName}" (
          "VEC_TEXT" NCLOB, 
          "VEC_META" NCLOB, 
          "VEC_VECTOR" REAL_VECTOR, 
          "Owner" NVARCHAR(100), 
          "quality" NVARCHAR(100)
        );
      `;
      await executeQuery(config.client, sqlStr);
      const vectorDB = await HanaDB.fromTexts(TEXTS, METADATAS, embeddings, {
        connection: config.client,
        tableName,
        specificMetadataColumns: ["Owner", "quality"],
      });
      const res = await executeQuery(
        config.client,
        `SELECT COUNT(*) AS COUNT FROM "${tableName}" WHERE "quality" = 'ugly'`
      );
      expect(res[0]?.COUNT ?? -1).toBe(3);

      let docs = await vectorDB.similaritySearch("hello", 5, {
        quality: "good",
      });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("foo");

      docs = await vectorDB.similaritySearch("hello", 5, { start: 100 });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("bar");

      docs = await vectorDB.similaritySearch("hello", 5, {
        start: 100,
        quality: "good",
      });
      expect(docs.length).toBe(0);

      docs = await vectorDB.similaritySearch("hello", 5, {
        start: 0,
        quality: "good",
      });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("foo");
    });

    test("test preexisting specific columns for metadata via array", async () => {
      const tableName = "PREEXISTING_FILTER_COLUMNS_VIA_ARRAY";

      const sqlStr = `
        CREATE TABLE "${tableName}" (
          "VEC_TEXT" NCLOB,
          "VEC_META" NCLOB,
          "VEC_VECTOR" REAL_VECTOR,
          "Owner" NVARCHAR(100),
          "quality" NVARCHAR(100)
        );
      `;
      await executeQuery(config.client, sqlStr);

      const vectorDB = await HanaDB.fromTexts(TEXTS, METADATAS, embeddings, {
        connection: config.client,
        tableName,
        specificMetadataColumns: ["quality"],
      });

      const resUgly = await executeQuery(
        config.client,
        `SELECT COUNT(*) AS COUNT FROM "${tableName}" WHERE "quality" = 'ugly'`
      );
      expect(resUgly[0]?.COUNT ?? -1).toBe(3);

      const resOwner = await executeQuery(
        config.client,
        `SELECT COUNT(*) AS COUNT FROM "${tableName}" WHERE "Owner" = 'Steve'`
      );
      expect(resOwner[0]?.COUNT ?? -1).toBe(0);

      let docs = await vectorDB.similaritySearch("hello", 5, {
        quality: "good",
      });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("foo");

      docs = await vectorDB.similaritySearch("hello", 5, { start: 100 });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("bar");

      docs = await vectorDB.similaritySearch("hello", 5, {
        start: 100,
        quality: "good",
      });
      expect(docs.length).toBe(0);

      docs = await vectorDB.similaritySearch("hello", 5, {
        start: 0,
        quality: "good",
      });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("foo");
    });

    test("test preexisting specific metadata columns multiple columns", async () => {
      const tableName = "PREEXISTING_FILTER_MULTIPLE_COLUMNS";

      const sqlStr = `
        CREATE TABLE "${tableName}" (
          "VEC_TEXT" NCLOB,
          "VEC_META" NCLOB,
          "VEC_VECTOR" REAL_VECTOR,
          "quality" NVARCHAR(100),
          "start" INTEGER
        );
      `;
      await executeQuery(config.client, sqlStr);

      const vectorDB = await HanaDB.fromTexts(TEXTS, METADATAS, embeddings, {
        connection: config.client,
        tableName,
        specificMetadataColumns: ["quality", "start"],
      });

      let docs = await vectorDB.similaritySearch("hello", 5, {
        quality: "good",
      });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("foo");

      docs = await vectorDB.similaritySearch("hello", 5, { start: 100 });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("bar");

      docs = await vectorDB.similaritySearch("hello", 5, {
        start: 100,
        quality: "good",
      });
      expect(docs.length).toBe(0);

      docs = await vectorDB.similaritySearch("hello", 5, {
        start: 0,
        quality: "good",
      });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("foo");
    });

    test("test preexisting specific metadata columns with empty columns", async () => {
      const tableName = "PREEXISTING_FILTER_MULTIPLE_COLUMNS_EMPTY";

      const sqlStr = `
        CREATE TABLE "${tableName}" (
          "VEC_TEXT" NCLOB,
          "VEC_META" NCLOB,
          "VEC_VECTOR" REAL_VECTOR,
          "quality" NVARCHAR(100),
          "ready" BOOLEAN,
          "start" INTEGER
        );
      `;
      await executeQuery(config.client, sqlStr);

      const vectorDB = await HanaDB.fromTexts(TEXTS, METADATAS, embeddings, {
        connection: config.client,
        tableName,
        specificMetadataColumns: ["quality", "ready", "start"],
      });

      let docs = await vectorDB.similaritySearch("hello", 5, {
        quality: "good",
      });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("foo");

      docs = await vectorDB.similaritySearch("hello", 5, { start: 100 });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("bar");

      docs = await vectorDB.similaritySearch("hello", 5, {
        start: 100,
        quality: "good",
      });
      expect(docs.length).toBe(0);

      docs = await vectorDB.similaritySearch("hello", 5, {
        start: 0,
        quality: "good",
      });
      expect(docs.length).toBe(1);
      expect(docs[0].pageContent).toBe("foo");

      docs = await vectorDB.similaritySearch("hello", 5, { ready: true });
      expect(docs.length).toBe(3);
    });

    test("test preexisting specific metadata columns with wrong type or non-existing", async () => {
      const tableName = "PREEXISTING_FILTER_COLUMNS_WRONG_TYPE";

      const sqlStr = `
        CREATE TABLE "${tableName}" (
          "VEC_TEXT" NCLOB,
          "VEC_META" NCLOB,
          "VEC_VECTOR" REAL_VECTOR,
          "quality" INTEGER
        );
      `;
      await executeQuery(config.client, sqlStr);

      // Expect failure due to wrong column type
      let exceptionOccurred = false;
      try {
        await HanaDB.fromTexts(TEXTS, METADATAS, embeddings, {
          connection: config.client,
          tableName,
          specificMetadataColumns: ["quality"],
        });
      } catch (err) {
        exceptionOccurred = true;
      }
      expect(exceptionOccurred).toBe(true);

      // Expect failure due to non-existing column
      exceptionOccurred = false;
      try {
        await HanaDB.fromTexts(TEXTS, METADATAS, embeddings, {
          connection: config.client,
          tableName,
          specificMetadataColumns: ["NonExistingColumn"],
        });
      } catch (err) {
        exceptionOccurred = true;
      }
      expect(exceptionOccurred).toBe(true);
    });

    test("test returned metadata completeness with preexisting specific columns", async () => {
      const tableName = "PREEXISTING_FILTER_COLUMNS_METADATA_COMPLETENESS";

      const sqlStr = `
        CREATE TABLE "${tableName}" (
          "VEC_TEXT" NCLOB,
          "VEC_META" NCLOB,
          "VEC_VECTOR" REAL_VECTOR,
          "quality" NVARCHAR(100),
          "NonExisting" NVARCHAR(100),
          "ready" BOOLEAN,
          "start" INTEGER
        );
      `;
      await executeQuery(config.client, sqlStr);

      const vectorDB = await HanaDB.fromTexts(TEXTS, METADATAS, embeddings, {
        connection: config.client,
        tableName,
        specificMetadataColumns: ["quality", "ready", "start", "NonExisting"],
      });

      const docs = await vectorDB.similaritySearch("hello", 5, {
        quality: "good",
      });

      expect(docs.length).toBe(1);
      const metadata = docs[0].metadata;

      expect(docs[0].pageContent).toBe("foo");
      expect(metadata.end).toBe(100);
      expect(metadata.start).toBe(0);
      expect(metadata.quality).toBe("good");
      expect(metadata.ready).toBe(true);
      expect("NonExisting" in metadata).toBe(false);
    });
  });

  test("hanavector add documents", async () => {
    await vectorDB.addDocuments(DOCUMENTS);
    const countResult = await executeQuery(
      config.client,
      `SELECT COUNT(*) AS COUNT FROM ${TABLE_NAME}`
    );
    expect(countResult[0]?.COUNT ?? -1).toBe(DOCUMENTS.length);
  });

  describe("add vector tests", () => {

    test("hanavector add vector with half vector", async () => {
      const tableName = "ADD_VECTOR_HALF_VECTOR";
      const vectorColumnType = "HALF_VECTOR";
      const args: HanaDBArgs = {
        connection: config.client,
        tableName,
        vectorColumnType,
      };
      const vectors = [
        [1, 2],
        [3, 4],
        [3, 5],
      ];

      const generatedEmbeddings = await Promise.all(
        vectors.map(async (vec) => {
          const vecString = `[${vec.join(",")}]`;
          const query = `SELECT TO_HALF_VECTOR('${vecString}') AS VEC FROM sys.DUMMY`;
          const result = await executeQuery(config.client, query);
          return result[0].VEC;
        })
      );

      vectorDB = new HanaDB(embeddings, args);
      await vectorDB.initialize();

      await vectorDB.addVectors(vectors, [
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
      ]);

      const res = await executeQuery(
        config.client,
        `SELECT VEC_VECTOR FROM ${tableName}`
      );
      expect(res.length).toBe(3);
      for (let i = 0; i < res.length; i += 1) {
        expect(res[i].VEC_VECTOR).toEqual(generatedEmbeddings[i]);
      }
    });

    test("hanavector add vector with real vector", async () => {

      const vectors = [
        [1, 2],
        [3, 4],
        [3, 5],
      ];

      const generatedEmbeddings = await Promise.all(
        vectors.map(async (vec) => {
          const vecString = `[${vec.join(",")}]`;
          const query = `SELECT TO_REAL_VECTOR('${vecString}') AS VEC FROM sys.DUMMY`;
          const result = await executeQuery(config.client, query);
          return result[0].VEC;
        })
      );

      await vectorDB.addVectors(vectors, [
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
      ]);

      const res = await executeQuery(
        config.client,
        `SELECT VEC_VECTOR FROM ${TABLE_NAME}`
      );
      expect(res.length).toBe(3);
      for (let i = 0; i < res.length; i += 1) {
        expect(res[i].VEC_VECTOR).toEqual(generatedEmbeddings[i]);
      }
    });
  });

  test("hanavector from texts", async () => {
    const vectorDB = await HanaDB.fromTexts(TEXTS, METADATAS, embeddings, {
      connection: config.client,
      tableName: "TEST_FROM_TEXTS",
    });
    expect(vectorDB).toBeInstanceOf(HanaDB);
    const countResult = await executeQuery(
      config.client,
      `SELECT COUNT(*) AS COUNT FROM TEST_FROM_TEXTS`
    );
    expect(countResult[0]?.COUNT ?? -1).toBe(TEXTS.length);
  });

  test("hanavector from documents", async () => {
    const vectorDB = await HanaDB.fromDocuments(DOCUMENTS, embeddings, {
      connection: config.client,
      tableName: "TEST_FROM_DOCUMENTS",
    });
    expect(vectorDB).toBeInstanceOf(HanaDB);
    const countResult = await executeQuery(
      config.client,
      `SELECT COUNT(*) AS COUNT FROM TEST_FROM_DOCUMENTS`
    );
    expect(countResult[0]?.COUNT ?? -1).toBe(DOCUMENTS.length);
  });
});

describe("similarity search tests", () => {
  test("test similarity search simple", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.similaritySearch(TEXTS[0], 1);

    expect(results[0].pageContent).toBe(TEXTS[0]);

    expect(results[0].pageContent).not.toBe(TEXTS[1]);
  });

  test("test similarity search simple half vector", async () => {
    const tableName = "TEST_TABLE_SIMILARITY_SEARCH_HALF_VECTOR";
    const vectorColumnType = "HALF_VECTOR";
    const args: HanaDBArgs = {
      connection: config.client,
      tableName,
      vectorColumnType,
    };

    vectorDB = new HanaDB(embeddings, args);
    await vectorDB.initialize();

    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.similaritySearch(TEXTS[0], 1);

    expect(results[0].pageContent).toBe(TEXTS[0]);

    expect(results[0].pageContent).not.toBe(TEXTS[1]);
  });

  describe("similarity search invalid", () => {
    const invalidKs = [0, -4];

    test.each(invalidKs)("throws ValueError for k = %i", async (k) => {
      await expect(vectorDB.similaritySearch(TEXTS[0], k)).rejects.toThrow(
        /must be an integer greater than 0/
      );
    });
  });

  test("similarity search vector with score simple", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    const vector = await embeddings.embedQuery(TEXTS[0]);

    const results = await vectorDB.similaritySearchVectorWithScore(vector, 1);

    expect(results[0][0].pageContent).toBe(TEXTS[0]);

    expect(results[0][0].pageContent).not.toBe(TEXTS[1]);
  });

  test("test similarity search vector with score half vector", async () => {
    const tableName = "TEST_TABLE_SIMILARITY_SEARCH_WITH_VECTOR_HALF_VECTOR";
    const vectorColumnType = "HALF_VECTOR";
    const args: HanaDBArgs = {
      connection: config.client,
      tableName,
      vectorColumnType,
    };
    vectorDB = new HanaDB(embeddings, args);
    await vectorDB.initialize();

    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.similaritySearch(TEXTS[0], 1);

    expect(results[0].pageContent).toBe(TEXTS[0]);

    expect(results[0].pageContent).not.toBe(TEXTS[1]);
  });

  describe("similarity search vector with score invalid k", () => {
    const invalidKs = [0, -4];

    test.each(invalidKs)("throws ValueError for k = %i", async (k) => {
      const vector = await embeddings.embedQuery(TEXTS[0]);
      await expect(
        vectorDB.similaritySearchVectorWithScore(vector, k)
      ).rejects.toThrow(/must be an integer greater than 0/);
    });
  });

  test("similarity search simple euclidean distance", async () => {
    const tableName = "TEST_TABLE_SEARCH_EUCLIDIAN";
    const vectorDB = await HanaDB.fromDocuments(DOCUMENTS, embeddings, {
      connection: config.client,
      tableName,
      distanceStrategy: "EUCLIDEAN",
    });

    const results = await vectorDB.similaritySearch(TEXTS[0], 1);

    expect(results[0].pageContent).toBe(TEXTS[0]);

    expect(results[0].pageContent).not.toBe(TEXTS[1]);
  });

  test("similarity search with metadata", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    const searchResult = await vectorDB.similaritySearch(TEXTS[0], 3);

    expect(searchResult[0].pageContent).toBe(TEXTS[0]);
    expect(searchResult[0].metadata.start).toBe(METADATAS[0].start);
    expect(searchResult[0].metadata.end).toBe(METADATAS[0].end);

    expect(searchResult[0].pageContent).not.toBe(TEXTS[1]);
    expect(searchResult[0].metadata.start).not.toBe(METADATAS[1].start);
    expect(searchResult[0].metadata.end).not.toBe(METADATAS[1].end);
  });

  test("similarity search with metadata filter (numeric)", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    let results = await vectorDB.similaritySearch(TEXTS[0], 3, { start: 100 });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe(TEXTS[1]);
    expect(results[0].metadata.start).toBe(METADATAS[1].start);
    expect(results[0].metadata.end).toBe(METADATAS[1].end);

    results = await vectorDB.similaritySearch(TEXTS[0], 3, {
      start: 100,
      end: 150,
    });
    expect(results).toHaveLength(0);

    results = await vectorDB.similaritySearch(TEXTS[0], 3, {
      start: 100,
      end: 200,
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe(TEXTS[1]);
    expect(results[0].metadata.start).toBe(METADATAS[1].start);
    expect(results[0].metadata.end).toBe(METADATAS[1].end);
  });

  test("similarity search with metadata filter (string)", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.similaritySearch(TEXTS[0], 3, {
      quality: "bad",
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe(TEXTS[1]);
  });

  test("similarity search with metadata filter (boolean)", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.similaritySearch(TEXTS[0], 3, {
      ready: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toBe(TEXTS[1]);
  });

  test("similarity search with metadata filter (invalid type)", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    await expect(
      vectorDB.similaritySearch(TEXTS[0], 3, {
        wrong_type: 0.1,
      })
    ).rejects.toThrow();
  });

  test("similarity search with score", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.similaritySearchWithScore(TEXTS[0], 3);

    expect(results[0][0].pageContent).toBe(TEXTS[0]);
    expect(results[0][1]).toBe(1.0);
    expect(results[1][1]).toBeLessThanOrEqual(results[0][1]);
    expect(results[2][1]).toBeLessThanOrEqual(results[1][1]);
    expect(results[2][1]).toBeGreaterThanOrEqual(0.0);
  });

  test("similarity search with score using Euclidean distance", async () => {
    const tableName = "TEST_TABLE_SCORE_DISTANCE";

    const vectorDB = await HanaDB.fromDocuments(DOCUMENTS, embeddings, {
      connection: config.client,
      tableName,
      distanceStrategy: "EUCLIDEAN",
    });

    const results = await vectorDB.similaritySearchWithScore(TEXTS[0], 3);

    expect(results[0][0].pageContent).toBe(TEXTS[0]);
    expect(results[0][1]).toBe(0.0); // 0.0 is best (closest) in Euclidean
    expect(results[1][1]).toBeGreaterThanOrEqual(results[0][1]);
    expect(results[2][1]).toBeGreaterThanOrEqual(results[1][1]);
  });
});

describe("delete tests", () => {
  test("delete with metadata filter", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    let results = await vectorDB.similaritySearch(TEXTS[0], 10);
    expect(results.length).toBe(5);

    // Delete one of the entries
    await vectorDB.delete({ filter: { start: 100, end: 200 } });

    results = await vectorDB.similaritySearch(TEXTS[0], 10);
    expect(results.length).toBe(4);
  });

  test("delete all with empty filter", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    let results = await vectorDB.similaritySearch(TEXTS[0], 3);
    expect(results.length).toBe(3);

    await vectorDB.delete({ filter: {} });

    results = await vectorDB.similaritySearch(TEXTS[0], 3);
    expect(results.length).toBe(0);
  });

  test("delete called incorrectly (no filter)", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    await expect(vectorDB.delete({})).rejects.toThrow();
  });

  test("delete called incorrectly (both ids and filter)", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    await expect(
      vectorDB.delete({
        ids: ["id1", "id"],
        filter: { start: 100, end: 200 },
      })
    ).rejects.toThrow();
  });
});

describe("max marginal relevance search tests", () => {
  test("max marginal relevance search simple", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.maxMarginalRelevanceSearch(TEXTS[0], {
      k: 2,
      fetchK: 20,
    });

    expect(results).toHaveLength(2);
    expect(results[0].pageContent).toBe(TEXTS[0]);
    expect(results[1].pageContent).not.toBe(TEXTS[0]);
  });

  test("max marginal relevance search simple half vector", async () => {
    const tableName = "TEST_TABLE_MMR_HALF_VECTOR";
    const vectorColumnType = "HALF_VECTOR";
    const args: HanaDBArgs = {
      connection: config.client,
      tableName,
      vectorColumnType,
    };
    vectorDB = new HanaDB(embeddings, args);
    await vectorDB.initialize();
    
    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.maxMarginalRelevanceSearch(TEXTS[0], {
      k: 2,
      fetchK: 20,
    });

    expect(results).toHaveLength(2);
    expect(results[0].pageContent).toBe(TEXTS[0]);
    expect(results[1].pageContent).not.toBe(TEXTS[0]);
  });

  describe("max marginal relevance search invalid", () => {
    const invalidCases: Array<[number, number, string]> = [
      [0, 20, "must be an integer greater than 0"],
      [-4, 20, "must be an integer greater than 0"],
      [2, 0, "greater than or equal to 'k'"],
    ];

    test.each(invalidCases)(
      "throws for invalid (k=%i, fetchK=%i)",
      async (k, fetchK, expectedMessage) => {
        await expect(
          vectorDB.maxMarginalRelevanceSearch(TEXTS[0], { k, fetchK })
        ).rejects.toThrow(expectedMessage);
      }
    );
  });
});

describe("hnsw index creation tests", () => {
  test("create hnsw index with default values", async () => {
    await vectorDB.addDocuments(DOCUMENTS);
    try {
      await vectorDB.createHnswIndex();
    } catch (e) {
      fail(`Failed to create HNSW index: ${e}`);
    }

    const results = await vectorDB.maxMarginalRelevanceSearch(TEXTS[0], {
      k: 2,
      fetchK: 20,
    });
    expect(results.length).toBe(2);
    expect(results[0].pageContent).toBe(TEXTS[0]);
    expect(results[1].pageContent).not.toBe(TEXTS[0]);
  });

  test("create hnsw index with defined values", async () => {
    await vectorDB.createHnswIndex({
      indexName: "my_L2_index",
      efSearch: 500,
      efConstruction: 200,
      m: 100,
    });

    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.maxMarginalRelevanceSearch(TEXTS[0], {
      k: 2,
      fetchK: 20,
    });
    expect(results.length).toBe(2);
    expect(results[0].pageContent).toBe(TEXTS[0]);
    expect(results[1].pageContent).not.toBe(TEXTS[0]);
  });

  test("create hnsw index after initialization", async () => {
    await vectorDB.createHnswIndex({
      indexName: "index_pre_add",
      efSearch: 400,
      efConstruction: 150,
      m: 50,
    });

    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.similaritySearch(TEXTS[0], 3);
    expect(results.length).toBe(3);
    expect(results[0].pageContent).toBe(TEXTS[0]);
    expect(results[1].pageContent).not.toBe(TEXTS[0]);
  });

  test("duplicate hnsw index creation", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    await vectorDB.createHnswIndex({
      indexName: "index_cosine",
      efSearch: 300,
      efConstruction: 100,
      m: 80,
    });

    await expect(
      vectorDB.createHnswIndex({
        efSearch: 300,
        efConstruction: 100,
        m: 80,
      })
    ).rejects.toThrow();
  });

  test("create hnsw index with invalid m value", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    await expect(vectorDB.createHnswIndex({ m: 3 })).rejects.toThrow();

    await expect(vectorDB.createHnswIndex({ m: 1001 })).rejects.toThrow();
  });

  test("create hnsw index with invalid ef_construction", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    await expect(
      vectorDB.createHnswIndex({ efConstruction: 0 })
    ).rejects.toThrow();

    await expect(
      vectorDB.createHnswIndex({ efConstruction: 100001 })
    ).rejects.toThrow();
  });

  test("create HNSW index with invalid ef_search", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    await expect(vectorDB.createHnswIndex({ efSearch: 0 })).rejects.toThrow();

    await expect(
      vectorDB.createHnswIndex({ efSearch: 100001 })
    ).rejects.toThrow();
  });
});

describe("keyword search tests", () => {
  test("hanavector keyword search with specific metadata column", async () => {
    const tableName =
      "TEST_TABLE_KEYWORD_SEARCH_WITHOUT_UNSPECIFIC_METADATA_COL";
    const sqlStr = `
    CREATE TABLE "${tableName}" (
      "VEC_TEXT" NCLOB,
      "VEC_META" NCLOB,
      "VEC_VECTOR" REAL_VECTOR,
      "quality" NVARCHAR(100),
      "start" INTEGER
    );
  `;

    await executeQuery(config.client, sqlStr);

    const vectorDB = await HanaDB.fromTexts(TEXTS, METADATAS, embeddings, {
      connection: config.client,
      tableName,
      specificMetadataColumns: ["quality"],
    });

    // Keyword search on content column
    const keyword = "foo";
    let docs = await vectorDB.similaritySearch(keyword, 3, {
      VEC_TEXT: { $contains: keyword },
    });
    expect(docs.length).toBe(1);
    expect(docs[0].pageContent).toContain(keyword);

    // Search with non-existing keyword
    const nonExistingKeyword = "nonexistent";
    docs = await vectorDB.similaritySearch(nonExistingKeyword, 3, {
      VEC_TEXT: { $contains: nonExistingKeyword },
    });
    expect(docs.length).toBe(0);

    // Keyword search on metadata column
    const metadataKeyword = "good";
    docs = await vectorDB.similaritySearch(metadataKeyword, 3, {
      quality: { $contains: metadataKeyword },
    });
    expect(docs.length).toBe(1);
    expect(docs[0].metadata.quality).toContain(metadataKeyword);

    // Non-existing keyword in metadata
    const missingMetaKeyword = "terrible";
    docs = await vectorDB.similaritySearch(missingMetaKeyword, 3, {
      quality: { $contains: missingMetaKeyword },
    });
    expect(docs.length).toBe(0);
  });

  test("hanavector keyword search without specific metadata column", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    const keyword = "good";

    // Exact match filter
    let docs = await vectorDB.similaritySearch("hello", 5, {
      quality: keyword,
    });
    expect(docs.length).toBe(1);
    expect(docs[0].pageContent).toContain("foo");

    // Keyword `$contains` filter on unspecific metadata
    docs = await vectorDB.similaritySearch("hello", 5, {
      quality: { $contains: keyword },
    });
    expect(docs.length).toBe(1);
    expect(docs[0].pageContent).toContain("foo");
    expect(docs[0].metadata.quality).toContain("good");

    // Non-matching keyword
    const nonExisting = "terrible";
    docs = await vectorDB.similaritySearch(nonExisting, 3, {
      quality: { $contains: nonExisting },
    });
    expect(docs.length).toBe(0);
  });
});
