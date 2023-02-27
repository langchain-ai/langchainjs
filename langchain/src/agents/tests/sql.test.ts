import { test, expect, beforeEach, afterEach } from "@jest/globals";
import sqlite3 from "sqlite3";
import {
  InfoSqlTool,
  QuerySqlTool,
  SqlDatabase,
  ListTablesSqlTool,
  QueryCheckerTool,
} from "../tools/sql.js";

let db: sqlite3.Database;

const previousEnv = process.env;

beforeEach(() => {
  db = new sqlite3.Database(":memory:");
  db.serialize(() => {
    db.run(
      "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)"
    );
    db.run("INSERT INTO users (name, age) VALUES ('Alice', 20)");
    db.run("INSERT INTO users (name, age) VALUES ('Bob', 21)");
    db.run("INSERT INTO users (name, age) VALUES ('Charlie', 22)");

    db.run(
      "CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INTEGER)"
    );
    db.run("INSERT INTO products (name, price) VALUES ('Apple', 100)");
    db.run("INSERT INTO products (name, price) VALUES ('Banana', 200)");
    db.run("INSERT INTO products (name, price) VALUES ('Orange', 300)");
  });

  process.env = { ...previousEnv, OPENAI_API_KEY: "test" };
});

afterEach(() => {
  db.close();

  process.env = previousEnv;
});

test("QuerySqlTool", async () => {
  const querySqlTool = new QuerySqlTool(new SqlDatabase(db));
  const result = await querySqlTool.call("SELECT * FROM users");
  expect(result).toBe(
    `
    {"id":1,"name":"Alice","age":20}
{"id":2,"name":"Bob","age":21}
{"id":3,"name":"Charlie","age":22}`.trim()
  );
});

test("QuerySqlTool with error", async () => {
  const querySqlTool = new QuerySqlTool(new SqlDatabase(db));
  const result = await querySqlTool.call("SELECT * FROM userss");
  expect(result).toBe(`Error: SQLITE_ERROR: no such table: userss`);
});

test("InfoSqlTool", async () => {
  const infoSqlTool = new InfoSqlTool(new SqlDatabase(db));
  const result = await infoSqlTool.call("users, products");
  expect(result).toBe(
    `
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)
{"id":1,"name":"Alice","age":20}
{"id":2,"name":"Bob","age":21}
{"id":3,"name":"Charlie","age":22}

CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INTEGER)
{"id":1,"name":"Apple","price":100}
{"id":2,"name":"Banana","price":200}
{"id":3,"name":"Orange","price":300}`.trim()
  );
});

test("InfoSqlTool with error", async () => {
  const infoSqlTool = new InfoSqlTool(new SqlDatabase(db));
  const result = await infoSqlTool.call("userss, products");
  expect(result).toBe(`Error: table userss does not exist`);
});

test("ListTablesSqlTool", async () => {
  const listSqlTool = new ListTablesSqlTool(new SqlDatabase(db));
  const result = await listSqlTool.call("");
  expect(result).toBe(
    `
    products
users`.trim()
  );
});

test("QueryCheckerTool", async () => {
  const queryCheckerTool = new QueryCheckerTool();
  expect(queryCheckerTool.llmChain).not.toBeNull();
  expect(queryCheckerTool.llmChain.inputKeys).toEqual(["query"]);
});
