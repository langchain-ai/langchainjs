import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { NodeFileStore } from "../node.js";

describe("NodeFileStore", () => {
  test("reads and writes files under the base path", async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "node-store-root-"));
    const store = new NodeFileStore(rootPath);

    await store.writeFile("foo.txt", "safe");

    await expect(store.readFile("foo.txt")).resolves.toBe("safe");

    await fs.promises.rm(rootPath, { recursive: true, force: true });
  });

  test("rejects traversal outside the base path", async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "node-store-root-"));
    const store = new NodeFileStore(rootPath);

    await expect(store.writeFile("../escape.txt", "x")).rejects.toThrowError();
    await expect(store.readFile("../escape.txt")).rejects.toThrowError();

    expect(fs.existsSync(path.join(path.dirname(rootPath), "escape.txt"))).toBe(
      false
    );

    await fs.promises.rm(rootPath, { recursive: true, force: true });
  });

  test("rejects traversal into sibling directories with the same prefix", async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "node-store-root-"));
    const siblingPath = `${rootPath}-sibling`;
    const store = new NodeFileStore(rootPath);

    await expect(
      store.writeFile(`../${path.basename(siblingPath)}/escape.txt`, "x")
    ).rejects.toThrowError();

    expect(fs.existsSync(path.join(siblingPath, "escape.txt"))).toBe(false);

    await fs.promises.rm(rootPath, { recursive: true, force: true });
    await fs.promises.rm(siblingPath, { recursive: true, force: true });
  });
});
