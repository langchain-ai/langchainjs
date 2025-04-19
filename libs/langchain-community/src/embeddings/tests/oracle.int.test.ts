import { test, expect } from "@jest/globals";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import oracledb from "oracledb";
import { OracleEmbeddings } from "../oracle.js";

test("Test embedQuery", async () => {
  const pref = {
    provider: "database",
    model: getEnvironmentVariable("ORACLE_MODEL"),
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

test("Test embedDocuments", async () => {
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
    model: getEnvironmentVariable("ORACLE_MODEL"),
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
