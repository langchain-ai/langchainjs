import { describe, test, expect, vi } from "vitest";
import {
  AsyncCaller,
  parseRetryAfterMs,
  classifyRateLimitError,
} from "../async_caller.js";

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

  test("defaultFailedAttemptHandler treats OpenAI-style errors with direct status as non-retryable", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    // OpenAI SDK errors have a direct `status` property, not `response.status`
    const err = Object.assign(new Error("Bad Request"), { status: 400 });
    const callable = vi.fn(async () => Promise.reject(err));

    await expect(() => caller.call(callable)).rejects.toThrow("Bad Request");
    expect(callable).toHaveBeenCalledTimes(1);
  });

  test("defaultFailedAttemptHandler retries on 5xx errors with direct status", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    // 5xx errors should be retried
    const callable = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        Object.assign(new Error("Internal Server Error"), { status: 500 })
      )
      .mockResolvedValueOnce();

    await expect(caller.call(callable)).resolves.toBeUndefined();
    expect(callable).toHaveBeenCalledTimes(2);
  });

  test("defaultFailedAttemptHandler prioritizes response.status over direct status", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    // If both exist, response.status should take precedence
    const err = Object.assign(new Error("Conflict"), {
      status: 500, // Would retry
      response: { status: 409 }, // Should not retry
    });
    const callable = vi.fn(async () => Promise.reject(err));

    await expect(() => caller.call(callable)).rejects.toThrow("Conflict");
    expect(callable).toHaveBeenCalledTimes(1);
  });

  test("defaultFailedAttemptHandler aborts headerless 429s with capacity error", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    const callable = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        Object.assign(new Error("Too Many Requests"), { status: 429 })
      );

    await expect(caller.call(callable)).rejects.toMatchObject({
      name: "RateLimitCapacityError",
      rateLimitType: "capacity",
      rateLimitReason: "headerless_429",
    });
    expect(callable).toHaveBeenCalledTimes(1);
  });

  test("defaultFailedAttemptHandler aborts quota-style 429s without retry-after", async () => {
    const caller = new AsyncCaller({ maxRetries: 3 });

    const err = Object.assign(
      new Error(
        "You exceeded your current quota, please check your plan and billing details."
      ),
      { status: 429 }
    );
    const callable = vi.fn(async () => Promise.reject(err));

    await expect(() => caller.call(callable)).rejects.toMatchObject({
      name: "RateLimitQuotaExhaustedError",
      rateLimitType: "stop",
      rateLimitReason: "quota_message",
    });
    expect(callable).toHaveBeenCalledTimes(1);
  });

  test("defaultFailedAttemptHandler aborts headerless statusCode 429s", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    const callable = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        Object.assign(new Error("Rate limit exceeded"), { statusCode: 429 })
      );

    await expect(caller.call(callable)).rejects.toMatchObject({
      name: "RateLimitCapacityError",
      rateLimitType: "capacity",
      rateLimitReason: "headerless_429",
    });
    expect(callable).toHaveBeenCalledTimes(1);
  });

  test("defaultFailedAttemptHandler aborts retry when Retry-After suggests quota exhaustion", async () => {
    const caller = new AsyncCaller({ maxRetries: 3 });

    const err = Object.assign(new Error("Quota exhausted"), {
      status: 429,
      headers: { "retry-after": "120" },
    });
    const callable = vi.fn(async () => Promise.reject(err));

    await expect(() => caller.call(callable)).rejects.toMatchObject({
      name: "RateLimitQuotaExhaustedError",
    });
    expect(callable).toHaveBeenCalledTimes(1);
  });

  test("defaultFailedAttemptHandler sets retryAfterMs on error for short Retry-After", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    const err = Object.assign(new Error("Too Many Requests"), {
      status: 429,
      headers: { "retry-after": "2" },
    });
    const callable = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce();

    await expect(caller.call(callable)).resolves.toBeUndefined();
    expect(callable).toHaveBeenCalledTimes(2);
    expect((err as unknown as Record<string, unknown>).retryAfterMs).toBe(2000);
  });

  test("defaultFailedAttemptHandler extracts Retry-After from Headers object", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    const headers = new Headers({ "retry-after": "3" });
    const err = Object.assign(new Error("Too Many Requests"), {
      status: 429,
      headers,
    });
    const callable = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce();

    await expect(caller.call(callable)).resolves.toBeUndefined();
    expect(callable).toHaveBeenCalledTimes(2);
    expect((err as unknown as Record<string, unknown>).retryAfterMs).toBe(3000);
  });

  test("defaultFailedAttemptHandler extracts Retry-After from response.headers", async () => {
    const caller = new AsyncCaller({ maxRetries: 2 });

    const err = Object.assign(new Error("Too Many Requests"), {
      statusCode: 429,
      response: {
        status: 429,
        headers: { "retry-after": "5" },
      },
    });
    const callable = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce();

    await expect(caller.call(callable)).resolves.toBeUndefined();
    expect(callable).toHaveBeenCalledTimes(2);
    expect((err as unknown as Record<string, unknown>).retryAfterMs).toBe(5000);
  });
});

describe("parseRetryAfterMs", () => {
  test("parses integer seconds", () => {
    expect(parseRetryAfterMs("30")).toBe(30_000);
  });

  test("parses zero", () => {
    expect(parseRetryAfterMs("0")).toBe(0);
  });

  test("returns undefined for null/undefined/empty", () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs(undefined)).toBeUndefined();
    expect(parseRetryAfterMs("")).toBeUndefined();
    expect(parseRetryAfterMs("  ")).toBeUndefined();
  });

  test("parses HTTP-date format", () => {
    const futureDate = new Date(Date.now() + 10_000).toUTCString();
    const result = parseRetryAfterMs(futureDate);
    expect(result).toBeGreaterThan(8_000);
    expect(result).toBeLessThanOrEqual(10_000);
  });

  test("returns 0 for past HTTP-date", () => {
    const pastDate = new Date(Date.now() - 5_000).toUTCString();
    expect(parseRetryAfterMs(pastDate)).toBe(0);
  });

  test("returns undefined for unparseable value", () => {
    expect(parseRetryAfterMs("not-a-number-or-date")).toBeUndefined();
  });
});

describe("classifyRateLimitError", () => {
  test("classifies insufficient_quota codes as stop", () => {
    const error = Object.assign(new Error("Insufficient quota"), {
      status: 429,
      error: { code: "insufficient_quota" },
    });

    expect(classifyRateLimitError(error)).toMatchObject({
      action: "stop",
      reason: "insufficient_quota",
    });
  });

  test("classifies quota and billing messages as stop", () => {
    const error = Object.assign(
      new Error(
        "You exceeded your current quota, please check your plan and billing details."
      ),
      { statusCode: 429 }
    );

    expect(classifyRateLimitError(error)).toMatchObject({
      action: "stop",
      reason: "quota_message",
    });
  });

  test("classifies long retry-after as capacity pressure", () => {
    const error = Object.assign(new Error("Too Many Requests"), {
      status: 429,
      headers: { "retry-after": "120" },
    });

    expect(classifyRateLimitError(error)).toMatchObject({
      action: "capacity",
      retryAfterMs: 120_000,
      reason: "retry_after_too_large",
    });
  });

  test("classifies short retry-after as wait", () => {
    const error = Object.assign(new Error("Too Many Requests"), {
      status: 429,
      headers: { "retry-after": "4" },
    });

    expect(classifyRateLimitError(error)).toEqual({
      action: "wait",
      retryAfterMs: 4000,
      reason: "retry_after_hint",
    });
  });

  test("classifies headerless 429s as capacity pressure", () => {
    expect(
      classifyRateLimitError(
        Object.assign(new Error("Rate limit exceeded"), { statusCode: 429 })
      )
    ).toEqual({
      action: "capacity",
      reason: "headerless_429",
    });
  });
});
