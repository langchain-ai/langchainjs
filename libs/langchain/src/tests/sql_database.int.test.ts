import { test, expect, beforeEach, afterEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { SqlDatabase } from "../sql_db.js";

let datasource: DataSource;

beforeEach(async () => {
  datasource = new DataSource({
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
});

afterEach(async () => {
  await datasource.destroy();
});

test("Test getTableInfo", async () => {
  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });
  const result = await db.getTableInfo(["users", "products"]);
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

test("Test getTableInfo with less tables than in db", async () => {
  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });
  const result = await db.getTableInfo(["products"]);
  const expectStr = `
CREATE TABLE products (
id INTEGER , name TEXT , price INTEGER ) 
SELECT * FROM "products" LIMIT 3;
 id name price
 1 Apple 100
 2 Banana 200
 3 Orange 300`;
  expect(result.trim()).toBe(expectStr.trim());
});

test("Test getTableInfo with includes tables", async () => {
  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
    includesTables: ["products"],
  });
  const result = await db.getTableInfo();
  const expectStr = `
CREATE TABLE products (
id INTEGER , name TEXT , price INTEGER ) 
SELECT * FROM "products" LIMIT 3;
 id name price
 1 Apple 100
 2 Banana 200
 3 Orange 300`;
  expect(result.trim()).toBe(expectStr.trim());
});

test("Test getTableInfo with ignoreTables", async () => {
  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
    ignoreTables: ["users"],
  });
  const result = await db.getTableInfo();
  const expectStr = `
CREATE TABLE products (
id INTEGER , name TEXT , price INTEGER ) 
SELECT * FROM "products" LIMIT 3;
 id name price
 1 Apple 100
 2 Banana 200
 3 Orange 300`;
  expect(result.trim()).toBe(expectStr.trim());
});

test("Test getTableInfo with error", async () => {
  await expect(async () => {
    const db = await SqlDatabase.fromDataSourceParams({
      appDataSource: datasource,
    });
    await db.getTableInfo(["users", "productss"]);
  }).rejects.toThrow(
    "Wrong target table name: the table productss was not found in the database"
  );
});

test("Test run", async () => {
  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
  });
  const result = await db.run("SELECT * FROM users");
  const expectStr = `[{"id":1,"name":"Alice","age":20},{"id":2,"name":"Bob","age":21},{"id":3,"name":"Charlie","age":22}]`;
  expect(result.trim()).toBe(expectStr.trim());
});

test("Test run with error", async () => {
  await expect(async () => {
    const db = await SqlDatabase.fromDataSourceParams({
      appDataSource: datasource,
    });
    await db.run("SELECT * FROM userss");
  }).rejects.toThrow("SQLITE_ERROR: no such table: userss");
});

test("Test customDescription initialization from DataSourceParams", async () => {
  const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
    customDescription: {
      products: "this is a customDescription for table in db",
      productss: "this customDescription should be skipped as table not in db",
    },
  });
  expect(db.customDescription).toStrictEqual({
    products: "this is a customDescription for table in db",
  });
});
