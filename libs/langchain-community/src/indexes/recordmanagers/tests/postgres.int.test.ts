import { describe, expect, test, jest } from "@jest/globals";
import { PoolConfig } from "pg";
import { PostgresRecordManager } from "../postgres.js";

describe("PostgresRecordManager", () => {
  const tableName = "upsertion_record";
  let recordManager: PostgresRecordManager;

  beforeAll(async () => {
    const config = {
      postgresConnectionOptions: {
        type: "postgres",
        host: "127.0.0.1",
        port: 5432,
        user: "myuser",
        password: "ChangeMe",
        database: "api",
      } as PoolConfig,
      namespace: "test",
      tableName,
    };
    recordManager = new PostgresRecordManager(config);
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

  test("Exists", async () => {
    const keys = ["a", "b", "c"];
    await recordManager.update(keys);
    console.log(await recordManager.listKeys());
    const exists = await recordManager.exists(keys);
    console.log(exists);
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
});
