import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import oracledb from "oracledb";
import { env } from "node:process";
import { OracleEmbeddings } from "../../embeddings/oracle.js";
import {
  createIndex,
  type OracleDBVSStoreArgs,
  OracleVS,
} from "../oraclevs.js";

test("Test vectorstore", async () => {
  const pool = await oracledb.createPool({
    user: env.ORACLE_USERNAME,
    password: env.ORACLE_PASSWORD,
    connectString: env.ORACLE_DSN,
  });

  const pref = {
    provider: "database",
    model: env.DEMO_ONNX_MODEL,
  };

  let connection: oracledb.Connection | undefined;
  try {
    connection = await pool.getConnection();
    await connection.execute(" drop table if exists embeddings");

    const embedder = new OracleEmbeddings(connection, pref);

    const dbConfig: OracleDBVSStoreArgs = {
      client: pool,
      tableName: "embeddings",
      distanceStrategy: "DOT",
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

    const oraclevs = await OracleVS.fromDocuments(docs, embedder, dbConfig);

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
      await connection?.release();
    }
  }
});

test("Test vectorstore addDocuments", async () => {
  const pool = await oracledb.createPool({
    user: env.ORACLE_USERNAME,
    password: env.ORACLE_PASSWORD,
    connectString: env.ORACLE_DSN,
  });

  const pref = {
    provider: "database",
    model: env.DEMO_ONNX_MODEL,
  };

  let connection: oracledb.Connection | undefined;
  try {
    connection = await pool.getConnection();
    await connection.execute(" drop table if exists embeddings");

    const embedder = new OracleEmbeddings(connection, pref);

    const dbConfig: OracleDBVSStoreArgs = {
      client: pool,
      tableName: "embeddings",
      distanceStrategy: "DOT",
      query: "What are salient features of oracledb",
    };

    const store = new OracleVS(embedder, dbConfig);
    await store.initialize();
    await store.addDocuments([
      { pageContent: "hello", metadata: { id: String(1), a: 2 } },
      { pageContent: "car", metadata: { id: String(2), a: 1 } },
      { pageContent: "adjective", metadata: { id: String(3), a: 1 } },
      { pageContent: "hi", metadata: { id: String(4), a: 1 } },
    ]);

    const results1 = await store.similaritySearch("hello!", 1);

    expect(results1).toHaveLength(1);
    /*
    expect(results1).toEqual([
      new Document({ metadata: { id: String(1), a: 2 }, pageContent: "hello" }),
    ]);
    */

    const results2 = await store.similaritySearchWithScore("hello!", 1, {
      a: 1,
    });

    expect(results2).toHaveLength(1);
  } finally {
    await connection?.release();
  }
});
