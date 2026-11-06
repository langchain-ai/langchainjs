import { test, expect } from "vitest";

import { RunnableLambda } from "../base.js";

test("RunnableLambda passes the caller's recursionLimit through to the function", async () => {
  let seen: number | undefined;
  const fn = RunnableLambda.from((input: Record<string, unknown>, config?: { recursionLimit?: number }) => {
    seen = config?.recursionLimit;
    return input;
  });
  await fn.invoke({ x: 1 }, { recursionLimit: 25 });
  expect(seen).toBe(25);
});

test("RunnableLambda decrements the recursion limit for a returned runnable", async () => {
  const seen: Array<number | undefined> = [];
  const inner = RunnableLambda.from((input: unknown, config?: { recursionLimit?: number }) => {
    seen.push(config?.recursionLimit);
    return input;
  });
  const outer = RunnableLambda.from((input: unknown) => inner);
  await outer.invoke("hello", { recursionLimit: 25 });

  // outer function sees the caller's limit, the nested runnable sees it decremented once
  expect(seen).toEqual([24]);
});

test("RunnableLambda still enforces the recursion limit", async () => {
  const inner = RunnableLambda.from((input: unknown) => input);
  const outer = RunnableLambda.from(() => inner);
  await expect(outer.invoke("x", { recursionLimit: 0 })).rejects.toThrow(
    "Recursion limit reached."
  );
});

test("RunnableLambda transform passes the caller's recursionLimit to the function", async () => {
  let seen: number | undefined;
  const fn = RunnableLambda.from(
    (input: Record<string, unknown>, config?: { recursionLimit?: number }) => {
      seen = config?.recursionLimit;
      return input;
    }
  );
  const chunks = [];
  for await (const chunk of await fn.transform([{ x: 1 }], { recursionLimit: 25 })) {
    chunks.push(chunk);
  }
  expect(chunks).toEqual([{ x: 1 }]);
  expect(seen).toBe(25);
});