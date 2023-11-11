/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { LocalFileStore } from "../file_system.js";

describe("LocalFileStore", () => {
  const keys = ["key1", "key2"];
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "file_system_store_test")
  );
  const secondaryRootPath = "./file_system_store_test_secondary";

  test("LocalFileStore can write & read values", async () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const store = await LocalFileStore.fromPath(tempDir);
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    await store.mset([
      [keys[0], encoder.encode(value1)],
      [keys[1], encoder.encode(value2)],
    ]);
    const retrievedValues = await store.mget([keys[0], keys[1]]);
    const everyValueDefined = retrievedValues.every((v) => v !== undefined);
    expect(everyValueDefined).toBe(true);
    expect(retrievedValues.map((v) => decoder.decode(v))).toEqual([
      value1,
      value2,
    ]);
  });

  test("LocalFileStore can delete values", async () => {
    const encoder = new TextEncoder();
    const store = await LocalFileStore.fromPath(tempDir);
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    await store.mset([
      [keys[0], encoder.encode(value1)],
      [keys[1], encoder.encode(value2)],
    ]);
    await store.mdelete(keys);
    const retrievedValues = await store.mget([keys[0], keys[1]]);
    const everyValueUndefined = retrievedValues.every((v) => v === undefined);
    expect(everyValueUndefined).toBe(true);
  });

  test("LocalFileStore can yield keys with prefix", async () => {
    const encoder = new TextEncoder();
    const prefix = "prefix_";
    const keysWithPrefix = keys.map((key) => `${prefix}${key}`);
    const store = await LocalFileStore.fromPath(tempDir);
    const value = new Date().toISOString();
    await store.mset(keysWithPrefix.map((key) => [key, encoder.encode(value)]));
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
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const store = await LocalFileStore.fromPath(secondaryRootPath);
    const value1 = new Date().toISOString();
    const value2 = new Date().toISOString() + new Date().toISOString();
    await store.mset([
      [keys[0], encoder.encode(value1)],
      [keys[1], encoder.encode(value2)],
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
        return decoder.decode(v);
      })
    ).toEqual([value1, value2]);
    await fs.promises.rm(secondaryRootPath, { recursive: true, force: true });
  });
});
