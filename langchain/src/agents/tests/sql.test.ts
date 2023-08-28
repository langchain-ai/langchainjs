/* eslint-disable no-process-env */
import { test, expect, beforeEach, afterEach } from "@jest/globals";
import { DataSource } from "typeorm";
import {
  InfoSqlTool,
  QuerySqlTool,
  ListTablesSqlTool,
  QueryCheckerTool,
} from "../../tools/sql.js";
import { SqlDatabase } from "../../sql_db.js";

const previousEnv = process.env;

let db: SqlDatabase;

beforeEach(async () => {
  const datasource = new DataSource({
    type: "sqlite",
    database: ":memory:",
    synchronize: true,
  });

  await datasource.initialize();

  await datasource.query(`
        CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INTEGER);
    `);
  await datasource.query(`
        INSERT INTO products (name, price) VALUES ('Apple', 100);
    `);
  await datasource.query(`
        INSERT INTO products (name, price) VALUES ('Banana', 200);
    `);
  await datasource.query(`
        INSERT INTO products (name, price) VALUES ('Orange', 300);
    `);
  await datasource.query(`
        CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER);
    `);
  await datasource.query(`
        INSERT INTO users (name, age) VALUES ('Alice', 20);
    `);
  await datasource.query(`
        INSERT INTO users (name, age) VALUES ('Bob', 21);
    `);
  await datasource.query(`
        INSERT INTO users (name, age) VALUES ('Charlie', 22);
    `);

  db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });

  process.env = { ...previousEnv, OPENAI_API_KEY: "test" };
});

afterEach(async () => {
  process.env = previousEnv;
  await db.appDataSource.destroy();
});

test("QuerySqlTool", async () => {
  const querySqlTool = new QuerySqlTool(db);
  const result = await querySqlTool.call("SELECT * FROM users");
  expect(result).toBe(
    `[{"id":1,"name":"Alice","age":20},{"id":2,"name":"Bob","age":21},{"id":3,"name":"Charlie","age":22}]`
  );
});

test("QuerySqlTool with error", async () => {
  const querySqlTool = new QuerySqlTool(db);
  const result = await querySqlTool.call("SELECT * FROM userss");
  expect(result).toBe(`QueryFailedError: SQLITE_ERROR: no such table: userss`);
});

test("InfoSqlTool", async () => {
  const infoSqlTool = new InfoSqlTool(db);
  const result = await infoSqlTool.call("users, products");
  const expectStr = `
CREATE TABLE products (
id INTEGER , name TEXT , price INTEGER ) 
SELECT * FROM "products" LIMIT 3;
 id name price
 1 Apple 100
 2 Banana 200
 3 Orange 300
CREATE TABLE users (
id INTEGER , name TEXT , age INTEGER ) 
SELECT * FROM "users" LIMIT 3;
 id name age
 1 Alice 20
 2 Bob 21
 3 Charlie 22`;
  expect(result.trim()).toBe(expectStr.trim());
});

test("InfoSqlTool with customDescription", async () => {
  db.customDescription = {
    products: "Custom Description for Products Table",
    users: "Custom Description for Users Table",
    userss: "Should not appear",
  };
  const infoSqlTool = new InfoSqlTool(db);
  const result = await infoSqlTool.call("users, products");
  const expectStr = `
Custom Description for Products Table
CREATE TABLE products (
id INTEGER , name TEXT , price INTEGER ) 
SELECT * FROM "products" LIMIT 3;
 id name price
 1 Apple 100
 2 Banana 200
 3 Orange 300
Custom Description for Users Table
CREATE TABLE users (
id INTEGER , name TEXT , age INTEGER ) 
SELECT * FROM "users" LIMIT 3;
 id name age
 1 Alice 20
 2 Bob 21
 3 Charlie 22`;
  expect(result.trim()).toBe(expectStr.trim());
});

test("InfoSqlTool with error", async () => {
  const infoSqlTool = new InfoSqlTool(db);
  const result = await infoSqlTool.call("userss, products");
  expect(result).toBe(
    `Error: Wrong target table name: the table userss was not found in the database`
  );
});

test("ListTablesSqlTool", async () => {
  const listSqlTool = new ListTablesSqlTool(db);
  const result = await listSqlTool.call("");
  expect(result).toBe(`products, users`);
});

test("QueryCheckerTool", async () => {
  const queryCheckerTool = new QueryCheckerTool();
  expect(queryCheckerTool.llmChain).not.toBeNull();
  expect(queryCheckerTool.llmChain.inputKeys).toEqual(["query"]);
});

test("ListTablesSqlTool with include tables", async () => {
  const includesTables = ["users"];
  db.includesTables = includesTables;
  const listSqlTool = new ListTablesSqlTool(db);
  const result = await listSqlTool.call("");
  expect(result).toBe("users");
});

test("ListTablesSqlTool with ignore tables", async () => {
  const ignoreTables = ["products"];
  db.ignoreTables = ignoreTables;
  const listSqlTool = new ListTablesSqlTool(db);
  const result = await listSqlTool.call("");
  expect(result).toBe("users");
});
