import { describe, expect, test, jest } from "@jest/globals";
import pg, { PoolConfig } from "pg";
import {
  PostgresRecordManager,
  PostgresRecordManagerOptions,
} from "../postgres.js";

describe.skip("PostgresRecordManager", () => {
  const tableName = "upsertion_record";
  const config = {
    postgresConnectionOptions: {
      type: "postgres",
      host: "127.0.0.1",
      port: 5432,
      user: "myuser",
      password: "ChangeMe",
      database: "api",
    } as PoolConfig,
    tableName,
  } as PostgresRecordManagerOptions;
  let recordManager: PostgresRecordManager;

  beforeAll(async () => {
    recordManager = new PostgresRecordManager("test", config);
    await recordManager.createSchema();
  });

  afterEach(async () => {
    // Drop table, then recreate it for the next test.
    await recordManager.pool.query(`DROP TABLE "${tableName}"`);

    await recordManager.createSchema();
  });

  afterAll(async () => {
    await recordManager.end();
  });

  test("Test provided postgres pool instance", async () => {
    const pool = new pg.Pool(config.postgresConnectionOptions);
    const providedPoolRecordManager = new PostgresRecordManager("test", {
      ...config,
      pool,
    });

    expect(providedPoolRecordManager.pool).toBe(pool);
  });

  test("Test explicit schema definition", async () => {
    // configure explicit schema with record manager
    config.schema = "newSchema";
    const explicitSchemaRecordManager = new PostgresRecordManager(
      "test",
      config
    );

    // create new schema for test
    console.log("creating new schema in test");
    await explicitSchemaRecordManager.pool.query('CREATE SCHEMA "newSchema"');

    // create table in new schema
    console.log("calling createSchema function from test");
    await explicitSchemaRecordManager.createSchema();

    // drop created schema
    await explicitSchemaRecordManager.pool.query(
      `DROP SCHEMA IF EXISTS "newSchema" CASCADE`
    );

    // end record manager connection
    await explicitSchemaRecordManager.end();
  });

  test("Test upsertion", async () => {
    const keys = ["a", "b", "c"];
    await recordManager.update(keys);
    const readKeys = await recordManager.listKeys();
    expect(readKeys).toEqual(expect.arrayContaining(keys));
    expect(readKeys).toHaveLength(keys.length);
  });

  test("Test upsertion with timeAtLeast", async () => {
    // Mock getTime to return 100.
    const unmockedGetTime = recordManager.getTime;
    recordManager.getTime = jest.fn(() => Promise.resolve(100));

    const keys = ["a", "b", "c"];
    await expect(
      recordManager.update(keys, { timeAtLeast: 110 })
    ).rejects.toThrowError();
    const readKeys = await recordManager.listKeys();
    expect(readKeys).toHaveLength(0);

    // Set getTime back to normal.
    recordManager.getTime = unmockedGetTime;
  });

  test("Test update timestamp", async () => {
    const unmockedGetTime = recordManager.getTime;
    recordManager.getTime = jest.fn(() => Promise.resolve(100));
    try {
      const keys = ["a", "b", "c"];
      await recordManager.update(keys);
      const res = await recordManager.pool.query(
        `SELECT * FROM "${tableName}"`
      );
      res.rows.forEach((row) => expect(row.updated_at).toEqual(100));

      recordManager.getTime = jest.fn(() => Promise.resolve(200));
      await recordManager.update(keys);
      const res2 = await recordManager.pool.query(
        `SELECT * FROM "${tableName}"`
      );
      res2.rows.forEach((row) => expect(row.updated_at).toEqual(200));
    } finally {
      recordManager.getTime = unmockedGetTime;
    }
  });

  test("Test update with groupIds", async () => {
    const keys = ["a", "b", "c"];
    await recordManager.update(keys, {
      groupIds: ["group1", "group1", "group2"],
    });
    const res = await recordManager.pool.query(
      `SELECT * FROM "${tableName}" WHERE group_id = ANY($1)`,
      [["group1"]]
    );
    expect(res.rowCount).toEqual(2);
    res.rows.forEach((row) => expect(row.group_id).toEqual("group1"));
  });

  test("Exists", async () => {
    const keys = ["a", "b", "c"];
    await recordManager.update(keys);
    const exists = await recordManager.exists(keys);
    expect(exists).toEqual([true, true, true]);

    const nonExistentKeys = ["d", "e", "f"];
    const nonExists = await recordManager.exists(nonExistentKeys);
    expect(nonExists).toEqual([false, false, false]);

    const mixedKeys = ["a", "e", "c"];
    const mixedExists = await recordManager.exists(mixedKeys);
    expect(mixedExists).toEqual([true, false, true]);
  });

  test("Delete", async () => {
    const keys = ["a", "b", "c"];
    await recordManager.update(keys);
    await recordManager.deleteKeys(["a", "c"]);
    const readKeys = await recordManager.listKeys();
    expect(readKeys).toEqual(["b"]);
  });

  test("List keys", async () => {
    const unmockedGetTime = recordManager.getTime;
    recordManager.getTime = jest.fn(() => Promise.resolve(100));
    try {
      const keys = ["a", "b", "c"];
      await recordManager.update(keys);
      const readKeys = await recordManager.listKeys();
      expect(readKeys).toEqual(expect.arrayContaining(keys));
      expect(readKeys).toHaveLength(keys.length);

      // All keys inserted after 90: should be all keys
      const readKeysAfterInsertedAfter = await recordManager.listKeys({
        after: 90,
      });
      expect(readKeysAfterInsertedAfter).toEqual(expect.arrayContaining(keys));

      // All keys inserted after 110: should be none
      const readKeysAfterInsertedBefore = await recordManager.listKeys({
        after: 110,
      });
      expect(readKeysAfterInsertedBefore).toEqual([]);

      // All keys inserted before 110: should be all keys
      const readKeysBeforeInsertedBefore = await recordManager.listKeys({
        before: 110,
      });
      expect(readKeysBeforeInsertedBefore).toEqual(
        expect.arrayContaining(keys)
      );

      // All keys inserted before 90: should be none
      const readKeysBeforeInsertedAfter = await recordManager.listKeys({
        before: 90,
      });
      expect(readKeysBeforeInsertedAfter).toEqual([]);

      // Set one key to updated at 120 and one at 80
      recordManager.getTime = jest.fn(() => Promise.resolve(120));
      await recordManager.update(["a"]);
      recordManager.getTime = jest.fn(() => Promise.resolve(80));
      await recordManager.update(["b"]);

      // All keys updated after 90 and before 110: should only be "c" now
      const readKeysBeforeAndAfter = await recordManager.listKeys({
        before: 110,
        after: 90,
      });
      expect(readKeysBeforeAndAfter).toEqual(["c"]);
    } finally {
      recordManager.getTime = unmockedGetTime;
    }
  });

  test("List keys with groupIds", async () => {
    const keys = ["a", "b", "c"];
    await recordManager.update(keys, {
      groupIds: ["group1", "group1", "group2"],
    });
    const readKeys = await recordManager.listKeys({ groupIds: ["group1"] });
    expect(readKeys).toEqual(["a", "b"]);
  });
});
