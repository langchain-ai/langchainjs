/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { test } from "@jest/globals";
import { RunnableBranch } from "../branch.js";

test("RunnableBranch invoke", async () => {
  const condition = (x: number) => x > 0;
  const add = (x: number) => x + 1;
  const subtract = (x: number) => x - 1;
  const branch = RunnableBranch.from([
    [condition, add],
    [condition, add],
    subtract,
  ]);
  const result = await branch.invoke(1);
  expect(result).toEqual(2);
  const result2 = await branch.invoke(-1);
  expect(result2).toEqual(-2);
});

test("RunnableBranch batch", async () => {
  const branch = RunnableBranch.from([
    [(x: number) => x > 0 && x < 5, (x: number) => x + 1],
    [(x: number) => x > 5, (x: number) => x * 10],
    (x: number) => x - 1,
  ]);
  const batchResult = await branch.batch([1, 10, 0]);
  expect(batchResult).toEqual([2, 100, -1]);
});

test("RunnableBranch handles error", async () => {
  let error;
  const branch = RunnableBranch.from([
    [
      (x: string) => x.startsWith("a"),
      () => {
        throw new Error("Testing");
      },
    ],
    (x) => `${x} passed`,
  ]);
  const result = await branch.invoke("branch", {
    callbacks: [
      {
        handleChainError: (e) => {
          error = e;
        },
      },
    ],
  });
  expect(result).toBe("branch passed");
  expect(error).toBeUndefined();
  await expect(async () => {
    await branch.invoke("alpha", {
      callbacks: [
        {
          handleChainError: (e) => {
            error = e;
          },
        },
      ],
    });
  }).rejects.toThrow();
  expect(error).toBeDefined();
});
