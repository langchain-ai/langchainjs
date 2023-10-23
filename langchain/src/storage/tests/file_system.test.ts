/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import fsPromises from "fs/promises";
import { NodeFileSystemStore } from "../file_system.js";

describe("UpstashRedisStore", () => {
  const keys = ["key1", "key2"];
  const path = "./file_system_store_test.json";
  const secondaryPath = "./file_system_store_test_secondary.json";

  afterEach(async () => {
    await fsPromises.unlink(path);
  });

  test("NodeFileSystemStore can write & read values", async () => {
    const store = new NodeFileSystemStore<string>({
      path,
    });
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    await store.mset([
      [keys[0], value1],
      [keys[1], value2],
    ]);
    const retrievedValues = await store.mget([keys[0], keys[1]]);
    const everyValueDefined = retrievedValues.every((v) => v !== undefined);
    expect(everyValueDefined).toBe(true);
    expect(retrievedValues.map((v) => v)).toEqual([value1, value2]);
  });

  test.only("NodeFileSystemStore can delete values", async () => {
    const store = new NodeFileSystemStore<string>({
      path,
    });
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    await store.mset([
      [keys[0], value1],
      [keys[1], value2],
    ]);
    await store.mdelete(keys);
    const retrievedValues = await store.mget([keys[0], keys[1]]);
    const everyValueUndefined = retrievedValues.every((v) => v === undefined);
    expect(everyValueUndefined).toBe(true);
  });

  test("NodeFileSystemStore can yield keys with prefix", async () => {
    const prefix = "prefix_";
    const keysWithPrefix = keys.map((key) => `${prefix}${key}`);
    const store = new NodeFileSystemStore<string>({
      path,
    });
    const value = new Date().toISOString();
    await store.mset(keysWithPrefix.map((key) => [key, value]));
    const yieldedKeys = [];
    for await (const key of store.yieldKeys(prefix)) {
      yieldedKeys.push(key);
    }
    console.log("Yielded keys:", yieldedKeys);
    expect(yieldedKeys.sort()).toEqual(keysWithPrefix.sort());
    // afterEach won't automatically delete these since we're applying a prefix.
    await store.mdelete(keysWithPrefix);
  });

  test("NodeFileSystemStore works with a file which does not exist", async () => {
    const store = new NodeFileSystemStore<string>({
      path: secondaryPath,
    });
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    await store.mset([
      [keys[0], value1],
      [keys[1], value2],
    ]);
    const retrievedValues = await store.mget([keys[0], keys[1]]);
    const everyValueDefined = retrievedValues.every((v) => v !== undefined);
    expect(everyValueDefined).toBe(true);
    console.log("retrievedValues", retrievedValues);
    expect(
      retrievedValues.map((v) => {
        if (!v) {
          throw new Error("Value is undefined");
        }
        return v;
      })
    ).toEqual([value1, value2]);
    // await fsPromises.rm(secondaryPath);
  });
});
