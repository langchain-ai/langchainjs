/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import oracledb from "oracledb";
import { OracleDocLoader } from "../index.js";

test("Test loading PDF from file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/1706.03762.pdf"
  );
  const pref = { file: filePath };
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USERNAME,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_DSN,
  });
  const loader = new OracleDocLoader(connection, pref);
  const docs = await loader.load();
  await connection.close();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toContain("Attention");
  expect(docs[0].pageContent).toContain("Is");
  expect(docs[0].pageContent).toContain("All");
  expect(docs[0].pageContent).toContain("You");
  expect(docs[0].pageContent).toContain("Need");
});

test("Test loading from directory", async () => {
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USERNAME,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_DSN,
  });
  const pref = {
    dir: process.env.DEMO_DIRECTORY,
  };
  const loader = new OracleDocLoader(connection, pref);
  const docs = await loader.load();
  await connection.close();

  expect(docs.length).toBeGreaterThanOrEqual(1);
});

test("Test loading from table", async () => {
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USERNAME,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_DSN,
  });
  const pref = {
    owner: process.env.DEMO_OWNER,
    tablename: process.env.DEMO_TABLE,
    colname: process.env.DEMO_COLUMN,
  };
  const loader = new OracleDocLoader(connection, pref);
  const docs = await loader.load();
  await connection.close();

  expect(docs.length).toBeGreaterThanOrEqual(1);
});
