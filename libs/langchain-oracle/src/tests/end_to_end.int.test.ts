/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import { Document } from "@langchain/core/documents";
import oracledb from "oracledb";
import {
  OracleDocLoader,
  OracleTextSplitter,
  OracleEmbeddings,
  OracleSummary,
  DistanceStrategy,
  dropTablePurge,
  createIndex,
  OracleVS,
} from "../index.js";

describe("Integrated Testing ", () => {
  let connection: oracledb.Connection | undefined;
  let pool: oracledb.Pool | undefined;
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/"
  );

  const loaderPref = { dir: filePath };
  const splitterPref = { by: "words", max: 100, normalize: "all" };
  const embedderPref = {
    provider: "database",
    model: process.env.DEMO_ONNX_MODEL,
  };
  const summaryPref = { provider: "database", gLevel: "P" };
  const tableName = "embeddings";

  afterAll(async () => {
    if (connection) {
      await dropTablePurge(connection as oracledb.Connection, tableName);
      await connection?.close();
      await pool?.close();
    }
  });

  test("Test end-to-end", async () => {
    pool = await oracledb.createPool({
      user: process.env.ORACLE_USERNAME,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_DSN,
    });

    connection = await pool.getConnection();

    // instantiate loader, splitter, and embedder
    const loader = new OracleDocLoader(connection, loaderPref);
    const splitter = new OracleTextSplitter(connection, splitterPref);
    const embedder = new OracleEmbeddings(connection, embedderPref);
    const summarizer = new OracleSummary(connection, summaryPref);

    const dbConfig = {
      client: pool,
      tableName,
      distanceStrategy: DistanceStrategy.DOT_PRODUCT,
      query: "What are salient features of oracledb",
      embeddings: embedder,
    };

    let total_chunk_id = 0;
    const total_chunks = [];

    // iterate through docs
    const docs = await loader.load();
    for (const [doc_id, doc] of docs.entries()) {
      // console.log("doc_id=" + doc_id);
      // console.log(doc);

      const summary = await summarizer.getSummary(doc.pageContent);
      // console.log(summary);

      // chunk doc
      const chunks = await splitter.splitText(doc.pageContent);
      console.log(`doc: ${doc_id + 1} # chunks: ${chunks.length}`);

      // accumulate chunks
      for (const [chunk_id, chunk] of chunks.entries()) {
        // inherit document metadata
        const chunk_metadata = { ...doc.metadata };

        // add chunk metadata
        // id is optional
        // chunk_metadata.id = String(total_chunk_id + 1);
        chunk_metadata.doc_id = String(doc_id + 1);
        chunk_metadata.chunk_id = String(chunk_id + 1);
        chunk_metadata.summary = summary;
        total_chunks.push(
          new Document({ pageContent: chunk, metadata: chunk_metadata })
        );
        total_chunk_id += 1;
      }
    }

    await dropTablePurge(connection as oracledb.Connection, tableName);

    const oraclevs = await OracleVS.fromDocuments(
      total_chunks,
      embedder,
      dbConfig
    );

    await createIndex(connection, oraclevs, {
      idxName: "embeddings_idx",
      idxType: "IVF",
      neighborPart: 64,
      accuracy: 90,
    });

    let matches = await oraclevs.similaritySearch(
      "What is an attention mask?",
      5
    );
    expect(matches).toHaveLength(5);
    expect(matches[0].metadata.summary).toContain("Transformer");

    matches = await oraclevs.similaritySearch("What is inattention?", 5);
    expect(matches).toHaveLength(5);
    expect(matches[0].metadata.summary).toContain(
      "What is considered as Normal Attention Span?"
    );

    matches = await oraclevs.similaritySearch(
      "software developer with experience in LLM's",
      5
    );
    expect(matches).toHaveLength(5);
    expect(matches[0].metadata.summary).toContain("Jacob Lee Resume");
  });
});
