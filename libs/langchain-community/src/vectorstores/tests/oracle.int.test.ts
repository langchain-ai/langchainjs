import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import oracledb from "oracledb";
import { env } from "node:process";
import { OracleEmbeddings } from "../../embeddings/oracle.js";
import {
  createIndex,
  DistanceStrategy,
  type OracleDBVSStoreArgs,
  OracleVS,
  dropTablePurge,
} from "../oraclevs.js";

describe("OracleVectorStore", () => {
  const tableName = "testlangchain_1";
  let pool: oracledb.Pool;
  let embedder: OracleEmbeddings;
  let connection: oracledb.Connection | undefined;
  let oraclevs: OracleVS | undefined;

  beforeAll(async () => {
    pool = await oracledb.createPool({
      user: env.ORACLE_USERNAME,
      password: env.ORACLE_PASSWORD,
      connectString: env.ORACLE_DSN,
    });

    const pref = {
      provider: "database",
      model: env.DEMO_ONNX_MODEL,
    };
    connection = await pool.getConnection();
    embedder = new OracleEmbeddings(connection, pref);
  });

  beforeEach(async () => {
    // Drop table for the next test.
    await dropTablePurge(connection as oracledb.Connection, tableName);
  });

  afterAll(async () => {
    await dropTablePurge(connection as oracledb.Connection, tableName);
    await connection?.close();
    await pool.close();
  });

  test("Test vectorstore fromDocuments", async () => {
    let connection: oracledb.Connection | undefined;

    try {
      connection = await pool.getConnection();
      const dbConfig: OracleDBVSStoreArgs = {
        client: pool,
        tableName,
        distanceStrategy: DistanceStrategy.DOT_PRODUCT,
        query: "What are salient features of oracledb",
      };

      const docs = [];
      docs.push(
        new Document({
          pageContent: "I like soccer.",
          metadata: { id: String(1) },
        })
      );
      docs.push(
        new Document({
          pageContent: "I love Stephen King.",
          metadata: { id: String(2) },
        })
      );

      oraclevs = await OracleVS.fromDocuments(docs, embedder, dbConfig);

      await createIndex(connection, oraclevs, {
        idxName: "embeddings_idx",
        idxType: "IVF",
        neighborPart: 64,
        accuracy: 90,
      });

      const embedding = await embedder.embedQuery(
        "What is your favourite sport?"
      );
      const matches = await oraclevs.similaritySearchVectorWithScore(
        embedding,
        5
      );

      expect(matches.length).toBeGreaterThanOrEqual(1);
    } finally {
      if (connection) {
        await connection?.close();
      }
    }
  });

  test("Test vectorstore addDocuments", async () => {
    const dbConfig: OracleDBVSStoreArgs = {
      client: pool,
      tableName,
      distanceStrategy: DistanceStrategy.DOT_PRODUCT,
      query: "What are salient features of oracledb",
    };

    oraclevs = new OracleVS(embedder, dbConfig);
    await oraclevs.initialize();
    await oraclevs.addDocuments([
      { pageContent: "hello", metadata: { id: String(1), a: 2 } },
      { pageContent: "car", metadata: { id: String(2), a: 1 } },
      { pageContent: "adjective", metadata: { id: String(3), a: 1 } },
      { pageContent: "hi", metadata: { id: String(4), a: 1 } },
    ]);

    const results1 = await oraclevs.similaritySearch("hello!", 1);

    expect(results1).toHaveLength(1);
    /*
    expect(results1).toEqual([
      new Document({ metadata: { id: String(1), a: 2 }, pageContent: "hello" }),
    ]);
    */

    const results2 = await oraclevs.similaritySearchWithScore("hello!", 1, {
      id: "1",
      a: 2,
    });
    expect(results2).toHaveLength(1);
  });
});
