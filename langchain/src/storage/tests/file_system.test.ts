/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import fsPromises from "fs/promises";
import { LocalFileStore } from "../file_system.js";

describe("LocalFileStore", () => {
  const keys = ["key1", "key2"];
  const path = "./file_system_store_test.json";
  const secondaryPath = "./file_system_store_test_secondary.json";

  afterEach(async () => {
    try {
      await fsPromises.access(path, fsPromises.constants.F_OK);
    } catch (e) {
      // file does not exist, so we don't need to delete it
      return;
    }
    await fsPromises.unlink(path);
  });

  test("LocalFileStore can write & read values", async () => {
    const store = await LocalFileStore.fromPath<string>(path);
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

  test("LocalFileStore can delete values", async () => {
    const store = await LocalFileStore.fromPath<string>(path);
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

  test("LocalFileStore can yield keys with prefix", async () => {
    const prefix = "prefix_";
    const keysWithPrefix = keys.map((key) => `${prefix}${key}`);
    const store = await LocalFileStore.fromPath<string>(path);
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

  test("LocalFileStore works with a file which does not exist", async () => {
    const store = await LocalFileStore.fromPath<string>(secondaryPath);
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
    await fsPromises.unlink(secondaryPath);
  });
});
