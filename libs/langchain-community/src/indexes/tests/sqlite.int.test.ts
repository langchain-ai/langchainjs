import { describe, expect, test, jest } from "@jest/globals";
import { SQLiteRecordManager } from "../sqlite.js";

describe("SQLiteRecordManager", () => {
  const tableName = "upsertion_record";
  let recordManager: SQLiteRecordManager;

  beforeAll(async () => {
    // Initialize SQLiteRecordManager with a temporary filepath
    const filepathOrConnectionString = ":memory:";
    recordManager = new SQLiteRecordManager('test', {tableName, filepathOrConnectionString});
    await recordManager.createSchema();
  });

  afterEach(() => {
    recordManager.db.exec(`DELETE FROM "${tableName}"`);
  });

  afterAll(() => {
    // Close the database connection after all tests have finished
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
      const rows = recordManager.db.prepare<RecordRow[]>(`SELECT * FROM "${tableName}"`).all() as RecordRow[];
      rows.forEach((row) => expect(row.updated_at).toEqual(100));
  
      recordManager.getTime = jest.fn(() => Promise.resolve(200));
      await recordManager.update(keys);
      const rows2 = await recordManager.db.prepare(`SELECT * FROM "${tableName}"`).all() as RecordRow[];
      rows2.forEach((row) => expect(row.updated_at).toEqual(200));
    } finally {
      recordManager.getTime = unmockedGetTime;
    }
  });
  
  test("Test update with groupIds", async () => {
    const keys = ["a", "b", "c"];
    await recordManager.update(keys, { groupIds: ["group1", "group1", "group2"] });
    const rows = recordManager.db.prepare(`SELECT * FROM "${tableName}" WHERE group_id = ?`).all("group1") as RecordRow[];
    expect(rows.length).toEqual(2);
    rows.forEach((row) => expect(row.group_id).toEqual("group1"));
  });

});