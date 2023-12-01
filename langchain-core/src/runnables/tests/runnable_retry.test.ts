/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { test } from "@jest/globals";
import { RunnableLambda } from "../base.js";

test("RunnableRetry invoke", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 3) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry();
  const result = await runnableRetry.invoke("");
  expect(result).toEqual(3);
});

test("RunnableRetry batch with thrown errors", async () => {
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      throw new Error("TEST ERROR");
    },
  });
  const runnableRetry = runnable.withRetry({
    stopAfterAttempt: 1,
  });
  await expect(async () => {
    await runnableRetry.batch(["", "", ""]);
  }).rejects.toThrow();
});

test("RunnableRetry batch with all returned errors", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 5) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry({
    stopAfterAttempt: 1,
  });
  const result = await runnableRetry.batch(["", "", ""], undefined, {
    returnExceptions: true,
  });
  expect(result).toEqual([
    new Error("TEST ERROR"),
    new Error("TEST ERROR"),
    new Error("TEST ERROR"),
  ]);
});

test("RunnableRetry batch should not retry successful requests", async () => {
  let attemptCount = 0;
  const runnable = new RunnableLambda({
    func: (_thing: unknown) => {
      attemptCount += 1;
      if (attemptCount < 3) {
        throw new Error("TEST ERROR");
      } else {
        return attemptCount;
      }
    },
  });
  const runnableRetry = runnable.withRetry({
    stopAfterAttempt: 2,
  });
  const result = await runnableRetry.batch(["", "", ""]);
  expect(attemptCount).toEqual(5);
  expect(result.sort()).toEqual([3, 4, 5]);
});
