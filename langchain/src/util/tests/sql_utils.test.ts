import { test, expect } from "@jest/globals";
import {
  verifyIgnoreTablesExistInDatabase,
  verifyIncludeTablesExistInDatabase,
} from "../sql_utils.js";

test("Find include tables when there are there", () => {
  const includeTables = ["user", "score"];
  const allTables = [
    { tableName: "plop", columns: [{ columnName: "id" }] },
    { tableName: "score", columns: [{ columnName: "id" }] },
    { tableName: "user", columns: [{ columnName: "id" }] },
    { tableName: "log", columns: [{ columnName: "id" }] },
  ];

  expect(() =>
    verifyIncludeTablesExistInDatabase(allTables, includeTables)
  ).not.toThrow();
});

test("Throw Error when include tables are not there", () => {
  const includeTables = ["user", "score"];
  const allTables = [
    { tableName: "plop", columns: [{ columnName: "id" }] },
    { tableName: "score", columns: [{ columnName: "id" }] },
    { tableName: "log", columns: [{ columnName: "id" }] },
  ];

  expect(() =>
    verifyIncludeTablesExistInDatabase(allTables, includeTables)
  ).toThrow();
});

test("Find include tables when there are there", () => {
  const includeTables = ["user", "score"];
  const allTables = [
    { tableName: "user", columns: [{ columnName: "id" }] },
    { tableName: "plop", columns: [{ columnName: "id" }] },
    { tableName: "score", columns: [{ columnName: "id" }] },
    { tableName: "log", columns: [{ columnName: "id" }] },
  ];

  expect(() =>
    verifyIgnoreTablesExistInDatabase(allTables, includeTables)
  ).not.toThrow();
});

test("Throw Error when include tables are not there", () => {
  const includeTables = ["user", "score"];
  const allTables = [
    { tableName: "plop", columns: [{ columnName: "id" }] },
    { tableName: "score", columns: [{ columnName: "id" }] },
    { tableName: "log", columns: [{ columnName: "id" }] },
  ];

  expect(() =>
    verifyIgnoreTablesExistInDatabase(allTables, includeTables)
  ).toThrow();
});
