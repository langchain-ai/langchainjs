import { test } from "@jest/globals";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { PostgresLoader, PostgresLoaderOptions } from "../loader.js";
import PostgresEngine from "../engine.js";

const SCHEMA_NAME = "public";
const CUSTOM_TABLE = "test_table_custom";
const CUSTOM_TABLE2 = "test_table";
const CONTENT_COLUMN = [
  "fruit_id",
  "fruit_name",
  "variety",
  "quantity_in_stock",
  "price_per_unit",
  "organic",
];
const METADATA_COLUMNS = ["variety"];
const FORMATTER = (
  row: { [key: string]: string },
  content_columns: string[]
): string =>
  content_columns
    .filter((column) => column in row)
    .map((column) => String(row[column]))
    .join(" ");

let url: string;
let container: StartedPostgreSqlContainer;
beforeAll(async () => {
  container = await new PostgreSqlContainer("pgvector/pgvector:pg16").start();

  url = `postgresql+asyncpg://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;
});

afterAll(async () => {
  await container.stop();
});

describe("Document loader creation", () => {
  let PEInstance: PostgresEngine;

  beforeAll(async () => {
    PEInstance = await PostgresEngine.fromConnectionString(url);

    await PEInstance.pool.raw(`DROP TABLE IF EXISTS "${CUSTOM_TABLE2}"`);

    await PEInstance.pool.raw(`CREATE TABLE IF NOT EXISTS "${CUSTOM_TABLE2}" (
      fruit_id SERIAL PRIMARY KEY,
      fruit_name VARCHAR(100) NOT NULL,
      variety VARCHAR(50),
      quantity_in_stock INT NOT NULL,
      price_per_unit INT NOT NULL,
      organic INT NOT NULL
    );`);

    await PEInstance.pool.raw(` INSERT INTO "${CUSTOM_TABLE2}" (
        fruit_name, variety, quantity_in_stock, price_per_unit, organic
    ) VALUES ('Apple', 'Granny Smith', 150, 1, 1); `);
  });

  test("should throw an error if no table name or query is provided", async () => {
    const documentLoaderArgs: PostgresLoaderOptions = {
      schemaName: undefined,
      query: undefined,
    };

    async function createInstance() {
      await PostgresLoader.initialize(PEInstance, documentLoaderArgs);
    }

    await expect(createInstance).rejects.toThrow(
      "At least one of the parameters 'table_name' or 'query' needs to be provided"
    );
  });

  test("should throw an error if an invalid format is provided", async () => {
    const documentLoaderArgs = {
      tableName: CUSTOM_TABLE2,
      format: "invalid_format",
    };

    async function createInstance() {
      // @ts-expect-error testing error
      await PostgresLoader.initialize(PEInstance, documentLoaderArgs);
    }

    await expect(createInstance).rejects.toThrow(
      "format must be type: 'csv', 'text', 'json', 'yaml'"
    );
  });

  test("should throw an error if both format and formatter are provided", async () => {
    const documentLoaderArgs: PostgresLoaderOptions = {
      tableName: CUSTOM_TABLE2,
      format: "text",
      formatter: FORMATTER,
    };

    async function createInstance() {
      await PostgresLoader.initialize(PEInstance, documentLoaderArgs);
    }

    await expect(createInstance()).rejects.toThrow(
      "Only one of 'format' or 'formatter' should be specified."
    );
  });

  test("should throw an error if both table name and query are provided", async () => {
    const documentLoaderArgs: PostgresLoaderOptions = {
      tableName: CUSTOM_TABLE2,
      schemaName: SCHEMA_NAME,
      query: "SELECT * FROM some_table",
    };

    async function createInstance() {
      await PostgresLoader.initialize(PEInstance, documentLoaderArgs);
    }

    await expect(createInstance()).rejects.toThrow(
      "Only one of 'table_name' or 'query' should be specified."
    );
  });

  test("should throw an error if content columns or metadata columns not match with column names", async () => {
    const documentLoaderArgs: PostgresLoaderOptions = {
      tableName: CUSTOM_TABLE2,
      schemaName: SCHEMA_NAME,
      contentColumns: ["Imnotacolunm"],
    };

    async function createInstance() {
      await PostgresLoader.initialize(PEInstance, documentLoaderArgs);
    }

    await expect(createInstance()).rejects.toThrow(
      `Column Imnotacolunm not found in query result fruit_id,fruit_name,variety,quantity_in_stock,price_per_unit,organic.`
    );
  });

  test("should create a new document Loader instance", async () => {
    const documentLoaderArgs: PostgresLoaderOptions = {
      tableName: CUSTOM_TABLE2,
      schemaName: "public",
      contentColumns: CONTENT_COLUMN,
      metadataColumns: METADATA_COLUMNS,
      format: "text",
      query: "",
      formatter: undefined,
    };

    const documentLoaderInstance = await PostgresLoader.initialize(
      PEInstance,
      documentLoaderArgs
    );

    expect(documentLoaderInstance).toBeDefined();
  });

  afterAll(async () => {
    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  });
});

describe("Document loader methods", () => {
  let PEInstance: PostgresEngine;
  let postgresLoaderInstance: PostgresLoader;

  beforeAll(async () => {
    PEInstance = await PostgresEngine.fromConnectionString(url);

    const documentLoaderArgs: PostgresLoaderOptions = {
      tableName: CUSTOM_TABLE,
      schemaName: SCHEMA_NAME,
      contentColumns: CONTENT_COLUMN,
      metadataColumns: METADATA_COLUMNS,
      format: "text",
      query: "",
      formatter: undefined,
    };

    await PEInstance.pool.raw(`DROP TABLE IF EXISTS "${CUSTOM_TABLE}"`);

    await PEInstance.pool.raw(`CREATE TABLE IF NOT EXISTS "${CUSTOM_TABLE}" (
      fruit_id SERIAL PRIMARY KEY,
      fruit_name VARCHAR(100) NOT NULL,
      variety VARCHAR(50),
      quantity_in_stock INT NOT NULL,
      price_per_unit INT NOT NULL,
      organic INT NOT NULL
    );`);

    await PEInstance.pool.raw(` INSERT INTO "${CUSTOM_TABLE}" (
        fruit_name, variety, quantity_in_stock, price_per_unit, organic
    ) VALUES ('Apple', 'Granny Smith', 150, 1, 1); `);

    postgresLoaderInstance = await PostgresLoader.initialize(
      PEInstance,
      documentLoaderArgs
    );
  });

  test("should load documents correctly", async () => {
    const documents = await postgresLoaderInstance.load();
    expect(documents).toBeDefined();
    expect(documents.length).toBeGreaterThan(0);
    expect(documents[0]).toHaveProperty("pageContent");
    expect(documents[0]).toHaveProperty("metadata");
  });

  afterAll(async () => {
    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  });
});
