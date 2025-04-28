import { describe, expect, test, jest } from "@jest/globals";
import { InMemoryRecordManager } from "../memory.js";

describe("MemoryRecordmanagerTest", () => {
  let recordManager: InMemoryRecordManager;

  beforeAll(async () => {
    recordManager = new InMemoryRecordManager();
    await recordManager.createSchema();
  });

  afterEach(async () => {
    // Clear records
    recordManager.records.clear();
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
      const res = recordManager.records;
      res.forEach((row) => expect(row.updatedAt).toEqual(100));

      recordManager.getTime = jest.fn(() => Promise.resolve(200));
      await recordManager.update(keys);
      const res2 = recordManager.records;
      res2.forEach((row) => expect(row.updatedAt).toEqual(200));
    } finally {
      recordManager.getTime = unmockedGetTime;
    }
  });

  test("Test update with groupIds", async () => {
    const keys = ["a", "b", "c"];
    await recordManager.update(keys, {
      groupIds: ["group1", "group1", "group2"],
    });
    const res = Array.from(recordManager.records).filter(
      ([_key, doc]) => doc.groupId === "group1"
    );
    expect(res.length).toEqual(2);
    res.forEach(([_, row]) => expect(row.groupId).toEqual("group1"));
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
