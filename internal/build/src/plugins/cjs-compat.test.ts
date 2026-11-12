import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { cjsCompatPlugin } from "./cjs-compat.ts";

for (const scenario of [
  { platform: "win32", code: "EPERM", failures: 1, attempts: 2 },
  { platform: "win32", code: "EACCES", failures: 1, attempts: 2 },
  { platform: "win32", code: "EBUSY", failures: 1, attempts: 2 },
  { platform: "win32", code: "EPERM", failures: 6, attempts: 6 },
  { platform: "win32", code: "ENOENT", failures: 1, attempts: 1 },
  { platform: "linux", code: "EPERM", failures: 1, attempts: 1 },
]) {
  test(`${scenario.platform} ${scenario.code} with ${scenario.failures} failures`, async (t) => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    Object.defineProperty(process, "platform", { value: scenario.platform });
    t.after(() => Object.defineProperty(process, "platform", platform));
    t.mock.method(fs, "readFile", async () => '{"name":"fixture"}');
    const write = t.mock.method(fs, "writeFile", async () => {});
    const cleanup = t.mock.method(fs, "rm", async () => {});
    const error = Object.assign(new Error("rename failed"), {
      code: scenario.code,
    });
    let attempts = 0;
    const rename = t.mock.method(fs, "rename", async () => {
      attempts += 1;
      if (attempts <= scenario.failures) throw error;
    });
    const hook = cjsCompatPlugin().buildEnd;
    assert.ok(hook && typeof hook === "object");
    const result = Promise.resolve().then(() => hook.handler.call({} as never));
    if (scenario.attempts <= scenario.failures) {
      await assert.rejects(result, (cause) => cause === error);
    } else {
      await result;
    }
    assert.equal(rename.mock.callCount(), scenario.attempts);
    const temporaryPath = write.mock.calls[0].arguments[0];
    assert.equal(rename.mock.calls[0].arguments[0], temporaryPath);
    assert.equal(
      rename.mock.calls[0].arguments[1],
      path.resolve(process.env.INIT_CWD ?? "", "package.json")
    );
    assert.deepEqual(cleanup.mock.calls[0].arguments, [
      temporaryPath,
      { force: true },
    ]);
  });
}
