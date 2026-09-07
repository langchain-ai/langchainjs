import { test, expect, describe, vi } from "vitest";
import { ContextOverflowError, getRetryable } from "@langchain/core/errors";
import { wrapAnthropicClientError } from "../errors.js";

describe("wrapAnthropicClientError", () => {
  test("should wrap context overflow error (prompt is too long)", () => {
    const originalError = {
      status: 400,
      message: "prompt is too long: 209752 tokens > 200000 maximum",
    };

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect(ContextOverflowError.isInstance(wrapped)).toBe(true);
    expect((wrapped as ContextOverflowError).message).toContain(
      "prompt is too long"
    );
    expect((wrapped as ContextOverflowError).cause).toBe(originalError);
  });

  test("should not wrap non-context-overflow 400 errors", () => {
    const originalError = {
      status: 400,
      message: "invalid request: something else went wrong",
    };

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).not.toBeInstanceOf(ContextOverflowError);
    expect(wrapped).toBe(originalError);
  });

  test("should still wrap tool errors as INVALID_TOOL_RESULTS", () => {
    const originalError = {
      status: 400,
      message: "invalid tool_use block",
    };

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).not.toBeInstanceOf(ContextOverflowError);
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("INVALID_TOOL_RESULTS");
  });

  test("should wrap 401 as MODEL_AUTHENTICATION", () => {
    const originalError = { status: 401, message: "Unauthorized" };

    const wrapped = wrapAnthropicClientError(originalError);

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("MODEL_AUTHENTICATION");
  });

  test("should wrap 404 as MODEL_NOT_FOUND", () => {
    const originalError = { status: 404, message: "Not Found" };

    const wrapped = wrapAnthropicClientError(originalError);

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("MODEL_NOT_FOUND");
  });

  test("should wrap 429 as MODEL_RATE_LIMIT", () => {
    const originalError = { status: 429, message: "Too Many Requests" };

    const wrapped = wrapAnthropicClientError(originalError);

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("MODEL_RATE_LIMIT");
  });

  test("should pass through unrecognized errors", () => {
    const originalError = { status: 500, message: "Internal Server Error" };

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBe(originalError);
  });
});

describe("wrapAnthropicClientError retryability", () => {
  test("marks context overflow non-retryable", () => {
    const wrapped = wrapAnthropicClientError({
      status: 400,
      message: "prompt is too long: 209752 tokens > 200000 maximum",
    });

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect(getRetryable(wrapped)).toBe(false);
  });

  test("marks invalid tool results non-retryable", () => {
    expect(
      getRetryable(
        wrapAnthropicClientError({
          status: 400,
          message: "invalid tool result block",
        })
      )
    ).toBe(false);
  });

  test("marks authentication failures non-retryable", () => {
    expect(
      getRetryable(
        wrapAnthropicClientError({ status: 401, message: "invalid x-api-key" })
      )
    ).toBe(false);
  });

  test("marks a missing model non-retryable", () => {
    expect(
      getRetryable(
        wrapAnthropicClientError({ status: 404, message: "model not found" })
      )
    ).toBe(false);
  });

  test("marks rate limits retryable", () => {
    expect(
      getRetryable(
        wrapAnthropicClientError({
          status: 429,
          message: "rate limit exceeded",
        })
      )
    ).toBe(true);
  });

  test("leaves server errors unclassified so they still retry", () => {
    expect(
      getRetryable(
        wrapAnthropicClientError({ status: 500, message: "internal error" })
      )
    ).toBeUndefined();
  });

  test("marks the original error in place without replacing it", () => {
    class APIError extends Error {
      status = 401;
    }
    const original = new APIError("invalid x-api-key");
    const wrapped = wrapAnthropicClientError(original);

    expect(wrapped).toBe(original);
    expect(wrapped).toBeInstanceOf(APIError);
    expect(getRetryable(wrapped)).toBe(false);
  });

  test("marking adds no enumerable property", () => {
    const raw = { status: 429, message: "rate limit exceeded" };
    const before = Object.keys(raw);
    const wrapped = wrapAnthropicClientError(raw);

    expect(getRetryable(wrapped)).toBe(true);
    expect(Object.keys(wrapped)).toEqual([...before, "lc_error_code"]);
  });

  test("preserves the legacy CONTEXT_OVERFLOW code alongside the mark", () => {
    const wrapped = wrapAnthropicClientError({
      status: 400,
      message: "prompt is too long: 209752 tokens > 200000 maximum",
    });

    expect(wrapped.lc_error_code).toBe("CONTEXT_OVERFLOW");
    expect(getRetryable(wrapped)).toBe(false);
  });
});

describe("per-call maxRetries", () => {
  test("a call option of 0 stops the caller retrying", async () => {
    const { ChatAnthropic } = await import("../../chat_models.js");
    const model = new ChatAnthropic({ apiKey: "test", maxRetries: 3 });

    const create = vi.fn(async () => {
      throw Object.assign(new Error("server"), { status: 500 });
    });
    (model as unknown as { batchClient: unknown }).batchClient = {
      messages: { create },
      beta: { messages: { create } },
    };

    await expect(model.invoke("hi", { maxRetries: 0 })).rejects.toThrow(
      "server"
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  test("without the option the configured retries still apply", async () => {
    const { ChatAnthropic } = await import("../../chat_models.js");
    const model = new ChatAnthropic({ apiKey: "test", maxRetries: 2 });

    const create = vi.fn(async () => {
      throw Object.assign(new Error("server"), { status: 500 });
    });
    (model as unknown as { batchClient: unknown }).batchClient = {
      messages: { create },
      beta: { messages: { create } },
    };

    await expect(model.invoke("hi")).rejects.toThrow("server");
    expect(create).toHaveBeenCalledTimes(3);
  });
});
