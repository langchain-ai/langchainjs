import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { describe, expect, test, vi } from "vitest";

import { LocalFileStore } from "../file_system.js";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: (value: T | PromiseLike<T>) => resolve(value),
    reject: (reason?: unknown) => reject(reason),
  };
}

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

  test("LocalFileStore uses last value for duplicate keys in mset", async () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const store = await LocalFileStore.fromPath(tempDir);
    const key = "duplicate-key";
    await store.mset([
      [key, encoder.encode("first")],
      [key, encoder.encode("second")],
    ]);
    const [value] = await store.mget([key]);
    expect(value).toBeDefined();
    expect(decoder.decode(value!)).toBe("second");
    await store.mdelete([key]);
  });

  test("LocalFileStore queues writes for the same key while a lock is held", async () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const store = await LocalFileStore.fromPath(tempDir);
    const key = "locked-key";

    const prototype = Object.getPrototypeOf(store) as {
      writeFileAtomically: (
        this: LocalFileStore,
        content: Uint8Array,
        fullPath: string
      ) => Promise<void>;
    };
    type WriteFileArgs = [Uint8Array, string];
    const originalWriteFileAtomically = prototype.writeFileAtomically;
    const firstWriteGate = createDeferred<void>();
    const writeFileSpy = vi
      .spyOn(prototype, "writeFileAtomically")
      .mockImplementationOnce(async function (
        this: LocalFileStore,
        ...args: WriteFileArgs
      ) {
        await firstWriteGate.promise;
        // Preserve original behavior once the first write is allowed to proceed.
        return originalWriteFileAtomically.apply(this, args);
      })
      .mockImplementation(function (
        this: LocalFileStore,
        ...args: WriteFileArgs
      ) {
        return originalWriteFileAtomically.apply(this, args);
      });

    try {
      const firstWrite = store.mset([[key, encoder.encode("first")]]);

      await expect.poll(() => writeFileSpy.mock.calls.length).toBe(1);

      const secondWrite = store.mset([[key, encoder.encode("second")]]);

      await new Promise((resolve) => setTimeout(resolve, 25));

      expect(writeFileSpy.mock.calls.length).toBe(1);

      firstWriteGate.resolve();

      await Promise.all([firstWrite, secondWrite]);

      expect(writeFileSpy.mock.calls.length).toBe(2);

      const [value] = await store.mget([key]);
      expect(value).toBeDefined();
      expect(decoder.decode(value!)).toBe("second");

      const { keyLocks } = store as unknown as {
        keyLocks: Map<string, Promise<void>>;
      };
      expect(keyLocks.size).toBe(0);
    } finally {
      writeFileSpy.mockRestore();
      await store.mdelete([key]);
    }
  });

  test("LocalFileStore removes orphaned temp files during initialization", async () => {
    const cleanupDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "file_system_store_cleanup")
    );
    const orphanFile = path.join(cleanupDir, "orphan.tmp");
    fs.writeFileSync(orphanFile, "stale");

    await LocalFileStore.fromPath(cleanupDir);

    const remaining = await fs.promises.readdir(cleanupDir);
    expect(remaining).not.toContain("orphan.tmp");

    await fs.promises.rm(cleanupDir, { recursive: true, force: true });
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
    // console.log("Yielded keys:", yieldedKeys);
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
    // console.log("retrievedValues", retrievedValues);
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

  test("Should disallow attempts to traverse paths outside of a subfolder", async () => {
    const encoder = new TextEncoder();
    const store = await LocalFileStore.fromPath(secondaryRootPath);
    const value1 = new Date().toISOString();
    await expect(
      store.mset([["../foo", encoder.encode(value1)]])
    ).rejects.toThrowError();
    await expect(
      store.mset([["/foo", encoder.encode(value1)]])
    ).rejects.toThrowError();
    await expect(
      store.mset([["\\foo", encoder.encode(value1)]])
    ).rejects.toThrowError();
    await expect(store.mget(["../foo"])).rejects.toThrowError();
    await expect(store.mget(["/foo"])).rejects.toThrowError();
    await expect(store.mget(["\\foo"])).rejects.toThrowError();
    await fs.promises.rm(secondaryRootPath, { recursive: true, force: true });
  });
});
