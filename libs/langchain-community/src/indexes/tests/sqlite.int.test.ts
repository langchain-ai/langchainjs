import { describe, expect, test, jest } from "@jest/globals";
import { SQLiteRecordManager } from "../sqlite.js";

describe("SQLiteRecordManager", () => {
  const tableName = "upsertion_record";
  let recordManager: SQLiteRecordManager;

  beforeAll(async () => {
    const localPath = ":memory:";
    recordManager = new SQLiteRecordManager("test", {
      tableName,
      localPath,
    });
    await recordManager.createSchema();
  });

  afterEach(async () => {
    recordManager.db.exec(`DELETE FROM "${tableName}"`);
    await recordManager.createSchema();
  });

  afterAll(() => {
    recordManager.db.close();
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

  interface RecordRow {
    // Define the structure of the rows returned from the database query
    // Adjust the properties based on your table schema
    id: number;
    key: string;
    updated_at: number;
    group_id: string;
  }

  test("Test update timestamp", async () => {
    const unmockedGetTime = recordManager.getTime;
    recordManager.getTime = jest.fn(() => Promise.resolve(100));
    try {
      const keys = ["a", "b", "c"];
      await recordManager.update(keys);
      const rows = recordManager.db
        .prepare<RecordRow[]>(`SELECT * FROM "${tableName}"`)
        .all() as RecordRow[];
      rows.forEach((row) => expect(row.updated_at).toEqual(100));

      recordManager.getTime = jest.fn(() => Promise.resolve(200));
      await recordManager.update(keys);
      const rows2 = (await recordManager.db
        .prepare(`SELECT * FROM "${tableName}"`)
        .all()) as RecordRow[];
      rows2.forEach((row) => expect(row.updated_at).toEqual(200));
    } finally {
      recordManager.getTime = unmockedGetTime;
    }
  });

  test("Test update with groupIds", async () => {
    const keys = ["a", "b", "c"];
    await recordManager.update(keys, {
      groupIds: ["group1", "group1", "group2"],
    });
    const rows = recordManager.db
      .prepare(`SELECT * FROM "${tableName}" WHERE group_id = ?`)
      .all("group1") as RecordRow[];
    expect(rows.length).toEqual(2);
    rows.forEach((row) => expect(row.group_id).toEqual("group1"));
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
