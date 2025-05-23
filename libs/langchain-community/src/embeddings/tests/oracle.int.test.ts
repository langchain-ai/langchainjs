import { test, expect } from "@jest/globals";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import oracledb from "oracledb";
import { OracleEmbeddings } from "../oracle.js";

test("Test embedQuery with database", async () => {
  const pref = {
    provider: "database",
    model: getEnvironmentVariable("DEMO_ONNX_MODEL"),
  };
  const connection = await oracledb.getConnection({
    user: getEnvironmentVariable("ORACLE_USERNAME"),
    password: getEnvironmentVariable("ORACLE_PASSWORD"),
    connectString: getEnvironmentVariable("ORACLE_DSN"),
  });
  const embeddings = new OracleEmbeddings(connection, pref);
  const queryEmbedding = await embeddings.embedQuery("Hello world!");
  await connection.close();

  expect(queryEmbedding.length).toBeGreaterThan(1);
});

test("Test embedDocuments with database", async () => {
  const texts = [
    "Hello world!",
    "Hello bad world!",
    "Hello nice world!",
    "Hello good world!",
    "1 + 1 = 2",
    "1 + 1 = 3",
  ];

  const pref = {
    provider: "database",
    model: getEnvironmentVariable("DEMO_ONNX_MODEL"),
  };
  const connection = await oracledb.getConnection({
    user: getEnvironmentVariable("ORACLE_USERNAME"),
    password: getEnvironmentVariable("ORACLE_PASSWORD"),
    connectString: getEnvironmentVariable("ORACLE_DSN"),
  });
  const embeddings = new OracleEmbeddings(connection, pref);
  const docEmbeddings = await embeddings.embedDocuments(texts);
  await connection.close();

  expect(docEmbeddings.length).toBe(6);
});

test("Test embedDocuments with third-party", async () => {
  const texts = [
    "Hello world!",
    "Hello bad world!",
    "Hello nice world!",
    "Hello good world!",
    "1 + 1 = 2",
    "1 + 1 = 3",
  ];

  const pref = {
    provider: "ocigenai",
    credential_name: getEnvironmentVariable("DEMO_CREDENTIAL"),
    url: "https://inference.generativeai.us-chicago-1.oci.oraclecloud.com/20231130/actions/embedText",
    model: "cohere.embed-english-v3.0",
  };

  const connection = await oracledb.getConnection({
    user: getEnvironmentVariable("ORACLE_USERNAME"),
    password: getEnvironmentVariable("ORACLE_PASSWORD"),
    connectString: getEnvironmentVariable("ORACLE_DSN"),
  });
  const embeddings = new OracleEmbeddings(connection, pref);
  const docEmbeddings = await embeddings.embedDocuments(texts);
  await connection.close();

  expect(docEmbeddings.length).toBe(6);
});
