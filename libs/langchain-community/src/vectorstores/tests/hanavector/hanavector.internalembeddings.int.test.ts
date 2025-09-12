/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/no-extraneous-dependencies
import hdbClient from "hdb";
import { test, expect } from "@jest/globals";
import { HanaTestUtils } from "./hanavector.test.utils";
import { HanaInternalEmbeddings } from "../../../embeddings/hana_internal.js";
import {
  executeQuery,
  executeStatement,
  prepareQuery,
} from "../../../utils/hanautils.js";
import { HanaDB, HanaDBArgs } from "../../hanavector.js";
import {
  DOCUMENTS,
  METADATAS,
  TABLE_NAME,
  TEXTS,
} from "./hanavector.test.constants";

const connectionParams = {
  host: process.env.HANA_DB_ADDRESS,
  port: process.env.HANA_DB_PORT,
  user: process.env.HANA_DB_USER,
  password: process.env.HANA_DB_PASSWORD,
};

class Config {
  client: any;

  schemaName: string;

  embeddings: HanaInternalEmbeddings;

  constructor(
    client: any,
    schemaName: string,
    embeddings: HanaInternalEmbeddings
  ) {
    this.client = client;
    this.schemaName = schemaName;
    this.embeddings = embeddings;
  }
}

let config: Config;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isInternalEmbeddingAvailable(
  client: any,
  embeddings: HanaInternalEmbeddings
): Promise<boolean> {
  try {
    const query = `
        SELECT TO_NVARCHAR(VECTOR_EMBEDDING('test', 'QUERY', ?))
        FROM sys.DUMMY;
        `;
    const stm = await prepareQuery(client, query);
    await executeStatement(stm, [embeddings.getModelId()]);
    return true;
  } catch (error) {
    return false;
  }
}

beforeAll(async () => {
  expect(process.env.HANA_DB_ADDRESS).toBeDefined();
  expect(process.env.HANA_DB_PORT).toBeDefined();
  expect(process.env.HANA_DB_USER).toBeDefined();
  expect(process.env.HANA_DB_PASSWORD).toBeDefined();
  expect(process.env.HANA_DB_EMBEDDING_MODEL_ID).toBeDefined();
  const client = await hdbClient.createClient(connectionParams);
  const schemaPrefix = "LANGCHAIN_INT_EMB_TEST";
  await HanaTestUtils.connectToHANA(client);
  config = new Config(
    client,
    await HanaTestUtils.generateSchemaName(client, schemaPrefix),
    new HanaInternalEmbeddings({
      internalEmbeddingModelId: process.env
        .HANA_DB_EMBEDDING_MODEL_ID as string,
    })
  );
  if (!(await isInternalEmbeddingAvailable(config.client, config.embeddings))) {
    throw new Error(
      `Internal embedding function is not available or the model id ${config.embeddings.getModelId()} is wrong`
    );
  }
  await HanaTestUtils.dropOldTestSchemas(client, schemaPrefix);
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
  vectorDB = new HanaDB(config.embeddings, args);
  expect(vectorDB).toBeDefined();
  await vectorDB.initialize();
});

afterEach(async () => {
  await HanaTestUtils.dropTable(config.client, TABLE_NAME);
});

test("hanavector add documents", async () => {
  await vectorDB.addDocuments(DOCUMENTS);
  const countResult = await executeQuery(
    config.client,
    `SELECT COUNT(*) AS COUNT FROM ${TABLE_NAME}`
  );
  expect(countResult[0]?.COUNT ?? -1).toBe(DOCUMENTS.length);
});

describe("similarity search tests", () => {
  test("test similarity search simple", async () => {
    await vectorDB.addDocuments(DOCUMENTS);

    const results = await vectorDB.similaritySearch(TEXTS[0], 1);

    expect(results[0].pageContent).toBe(TEXTS[0]);

    expect(results[0].pageContent).not.toBe(TEXTS[1]);
  });

  test("test similarity search simple half vector", async () => {
    const tableName = "TEST_TABLE_INT_EMB_SIMILARITY_SEARCH_HALF_VECTOR";
    const vectorColumnType = "HALF_VECTOR";
    const args: HanaDBArgs = {
      connection: config.client,
      tableName,
      vectorColumnType,
    };

    vectorDB = new HanaDB(config.embeddings, args);
    await vectorDB.initialize();

    console.log("Table initialized");

    await vectorDB.addDocuments(DOCUMENTS);

    console.log("Documents added");

    const results = await vectorDB.similaritySearch(TEXTS[0], 1);

    console.log("Similarity search done");

    expect(results[0].pageContent).toBe(TEXTS[0]);

    expect(results[0].pageContent).not.toBe(TEXTS[1]);
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

  describe("similarity search invalid", () => {
    const invalidKs = [0, -4];

    test.each(invalidKs)("throws ValueError for k = %i", async (k) => {
      await expect(vectorDB.similaritySearch(TEXTS[0], k)).rejects.toThrow(
        /must be an integer greater than 0/
      );
    });
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
    vectorDB = new HanaDB(config.embeddings, args);
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
