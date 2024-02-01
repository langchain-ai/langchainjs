import { test, expect, jest } from "@jest/globals";
import { AsyncCaller } from "../async_caller.js";

test("AsyncCaller passes on arguments and returns return value", async () => {
  const caller = new AsyncCaller({});
  const callable = jest.fn((arg1, arg2) => Promise.resolve([arg2, arg1]));

  const resultDirect = await callable(1, 2);
  const resultWrapped = await caller.call(callable, 1, 2);

  expect(resultDirect).toEqual([2, 1]);
  expect(resultWrapped).toEqual([2, 1]);
});

test("AsyncCaller retries on failure", async () => {
  const caller = new AsyncCaller({});

  // A direct call throws an error.
  let callable = jest
    .fn<() => Promise<number[]>>()
    .mockRejectedValueOnce("error")
    .mockResolvedValueOnce([2, 1]);

  await expect(() => callable()).rejects.toEqual("error");

  // A wrapped call retries and succeeds.
  callable = jest
    .fn<() => Promise<number[]>>()
    .mockRejectedValueOnce("error")
    .mockResolvedValueOnce([2, 1]);

  const resultWrapped = await caller.call(callable);

  expect(resultWrapped).toEqual([2, 1]);
  expect(callable.mock.calls).toHaveLength(2);
});
