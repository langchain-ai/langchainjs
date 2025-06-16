import { describe, expect, test } from "@jest/globals";
import { IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import knex from "knex";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import PostgresEngine, {
  PostgresEngineArgs,
  Column,
  VectorStoreTableArgs,
} from "../engine.js";

const CUSTOM_TABLE = "test_table_custom_engine";
const CHAT_MSG_TABLE = "test_message_table_engine";
const VECTOR_SIZE = 768;
const ID_COLUMN = "uuid";
const CONTENT_COLUMN = "my_content";
const EMBEDDING_COLUMN = "my_embedding";
const METADATA_COLUMNS = [
  new Column("page", "TEXT"),
  new Column("source", "TEXT"),
];
const STORE_METADATA = true;
let url: string;
let container: StartedPostgreSqlContainer;

const poolConfig: knex.Knex.PoolConfig = {
  min: 0,
  max: 5,
};

afterAll(async () => {
  await container.stop();
});

describe("PostgresEngine Instance creation", () => {
  let PEInstance: PostgresEngine;

  test.skip("should throw an error if only user or password are passed", async () => {
    const pgArgs: PostgresEngineArgs = {
      user: container.getUsername() ?? "",
    };

    async function createInstance() {
      PEInstance = await PostgresEngine.fromInstance(
        "projectId",
        "region",
        "instance",
        "database",
        pgArgs
      );
    }

    await expect(createInstance).rejects.toThrow(
      "Only one of 'user' or 'password' were specified. Either " +
        "both should be specified to use basic user/password " +
        "authentication or neither for IAM DB authentication."
    );
  });

  // Google Cloud test only
  test.skip("should create a PostgresEngine Instance with IAM email", async () => {
    const pgArgs: PostgresEngineArgs = {
      ipType: IpAddressTypes.PUBLIC,
      // eslint-disable-next-line no-process-env
      iamAccountEmail: process.env.EMAIL ?? "",
    };

    PEInstance = await PostgresEngine.fromInstance(
      "projectId",
      "region",
      "instance",
      "database",
      pgArgs
    );

    const { rows } = await PEInstance.testConnection();
    const currentTimestamp = rows[0].currenttimestamp;
    expect(currentTimestamp).toBeDefined();

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  });

  test("should throw an error if the URL passed to from_engine_args does not have the driver", async () => {
    async function createInstance() {
      PEInstance = await PostgresEngine.fromConnectionString("url");
    }

    await expect(createInstance).rejects.toThrow(
      "Driver must be type 'postgresql+asyncpg'"
    );
  });
});

describe("PostgresEngine - table initialization", () => {
  let PEInstance: PostgresEngine;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("pgvector/pgvector:pg16").start();
    url = `postgresql+asyncpg://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

    PEInstance = await PostgresEngine.fromConnectionString(url, poolConfig);
  });

  test("should create the vectorstore table", async () => {
    const vsTableArgs: VectorStoreTableArgs = {
      contentColumn: CONTENT_COLUMN,
      embeddingColumn: EMBEDDING_COLUMN,
      idColumn: ID_COLUMN,
      metadataColumns: METADATA_COLUMNS,
      storeMetadata: STORE_METADATA,
      overwriteExisting: true,
    };

    await PEInstance.initVectorstoreTable(
      CUSTOM_TABLE,
      VECTOR_SIZE,
      vsTableArgs
    );

    const query = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${CUSTOM_TABLE}';`;
    const expected = [
      { column_name: "uuid", data_type: "uuid" },
      { column_name: "my_embedding", data_type: "USER-DEFINED" },
      { column_name: "langchain_metadata", data_type: "json" },
      { column_name: "my_content", data_type: "text" },
      { column_name: "page", data_type: "text" },
      { column_name: "source", data_type: "text" },
    ];

    const { rows } = await PEInstance.pool.raw(query);

    rows.forEach((row: string, index: number) => {
      expect(row).toMatchObject(expected[index]);
    });
  });

  test("should create the chat history table", async () => {
    await PEInstance.initChatHistoryTable(CHAT_MSG_TABLE);

    const query = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${CHAT_MSG_TABLE}';`;
    const expected = [
      { column_name: "id", data_type: "integer" },
      { column_name: "data", data_type: "jsonb" },
      { column_name: "session_id", data_type: "text" },
      { column_name: "type", data_type: "text" },
    ];

    const { rows } = await PEInstance.pool.raw(query);

    rows.forEach((row: string, index: number) => {
      expect(row).toMatchObject(expected[index]);
    });
  });

  afterAll(async () => {
    await PEInstance.pool.raw(`DROP TABLE "${CUSTOM_TABLE}"`);
    await PEInstance.pool.raw(`DROP TABLE "${CHAT_MSG_TABLE}"`);

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  });
});
