import { describe, test, expect, vi } from "vitest";
import { AsyncCaller } from "../async_caller.js";

describe("AsyncCaller", () => {
  test("defaultFailedAttemptHandler handles undefined error", () => {
    const caller = new AsyncCaller({ maxRetries: 0 });

    expect(() =>
      (
        caller as unknown as {
          onFailedAttempt: (error: unknown) => void;
        }
      ).onFailedAttempt(undefined)
    ).not.toThrow();
  });

  test("defaultFailedAttemptHandler throws InsufficientQuotaError", async () => {
    const caller = new AsyncCaller({ maxRetries: 0 });

    const err = new Error("Insufficient quota");
    // Some SDKs attach a nested `error.code` payload onto an Error instance.
    (err as unknown as { error: { code: string } }).error = {
      code: "insufficient_quota",
    };
    const callable = vi.fn(async () => Promise.reject(err));

    await expect(() => caller.call(callable)).rejects.toMatchObject({
      name: "InsufficientQuotaError",
      message: "Insufficient quota",
    });
  });

  test("passes on arguments and returns return value", async () => {
    const caller = new AsyncCaller({ maxRetries: 0 });
    const callable = vi.fn((arg1, arg2) => Promise.resolve([arg2, arg1]));

    const resultDirect = await callable(1, 2);
    const resultWrapped = await caller.call(callable, 1, 2);

    expect(resultDirect).toEqual([2, 1]);
    expect(resultWrapped).toEqual([2, 1]);
  });

  test("retries on failure", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    // A direct call throws an error.
    let callable = vi
      .fn<() => Promise<number[]>>()
      .mockRejectedValueOnce("error")
      .mockResolvedValueOnce([2, 1]);

    await expect(() => callable()).rejects.toEqual("error");

    // A wrapped call retries and succeeds.
    callable = vi
      .fn<() => Promise<number[]>>()
      .mockRejectedValueOnce("error")
      .mockResolvedValueOnce([2, 1]);

    const resultWrapped = await caller.call(callable);

    expect(resultWrapped).toEqual([2, 1]);
    expect(callable.mock.calls).toHaveLength(2);
  });

  test("defaultFailedAttemptHandler treats AbortError as non-retryable", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    const err = new Error("AbortError: user cancelled");
    err.name = "AbortError";
    const callable = vi.fn(async () => Promise.reject(err));

    await expect(() => caller.call(callable)).rejects.toThrow("AbortError");
    expect(callable).toHaveBeenCalledTimes(1);
  });

  test("defaultFailedAttemptHandler treats ECONNABORTED as non-retryable", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    const err = new Error("Request timed out");
    (err as unknown as { code: string }).code = "ECONNABORTED";
    const callable = vi.fn(async () => Promise.reject(err));

    await expect(() => caller.call(callable)).rejects.toThrow(
      "Request timed out"
    );
    expect(callable).toHaveBeenCalledTimes(1);
  });

  test("defaultFailedAttemptHandler treats 4xx errors as non-retryable", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    const err = new Error("Bad Request");
    (err as unknown as { response: { status: number } }).response = {
      status: 400,
    };
    const callable = vi.fn(async () => Promise.reject(err));

    await expect(() => caller.call(callable)).rejects.toThrow("Bad Request");
    expect(callable).toHaveBeenCalledTimes(1);
  });
});
