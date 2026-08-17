import { test, expect, describe } from "vitest";
import { ContextOverflowError, getRetryable } from "@langchain/core/errors";
import { wrapOpenAIClientError } from "../client.js";

describe("wrapOpenAIClientError", () => {
  test("should wrap context overflow error (context_length_exceeded code)", () => {
    const originalError = {
      status: 400,
      message:
        "This model's maximum context length is 8192 tokens. However, your messages resulted in 10000 tokens.",
      code: "context_length_exceeded",
      toString() {
        return `BadRequestError: ${this.message} (code: ${this.code})`;
      },
      constructor: { name: "BadRequestError" },
    };

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect(ContextOverflowError.isInstance(wrapped)).toBe(true);
    expect((wrapped as ContextOverflowError).message).toContain(
      "maximum context length"
    );
    expect((wrapped as ContextOverflowError).cause).toBe(originalError);
  });

  test("should wrap context overflow error (Input tokens exceed)", () => {
    const originalError = {
      status: 400,
      message:
        "Input tokens exceed the configured limit of 272000 tokens. Your messages resulted in 300007 tokens.",
      constructor: { name: "BadRequestError" },
    };

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect(ContextOverflowError.isInstance(wrapped)).toBe(true);
    expect((wrapped as ContextOverflowError).message).toContain(
      "Input tokens exceed the configured limit"
    );
    expect((wrapped as ContextOverflowError).cause).toBe(originalError);
  });

  test("should wrap context overflow error (exceeds the context window)", () => {
    const originalError = {
      status: 400,
      message:
        "Your input exceeds the context window of this model. Please adjust your input and try again.",
      constructor: { name: "APIError" },
    };

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect(ContextOverflowError.isInstance(wrapped)).toBe(true);
    expect((wrapped as ContextOverflowError).message).toContain(
      "exceeds the context window"
    );
    expect((wrapped as ContextOverflowError).cause).toBe(originalError);
  });

  test("should wrap context overflow error (maximum context length)", () => {
    const originalError = {
      status: 400,
      message:
        "This model's maximum context length is 131072 tokens. However, you requested 131079 tokens (131079 in the messages, 0 in the completion). Please reduce the length of the messages or completion.",
      constructor: { name: "BadRequestError" },
    };

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect(ContextOverflowError.isInstance(wrapped)).toBe(true);
    expect((wrapped as ContextOverflowError).message).toContain(
      "maximum context length"
    );
    expect((wrapped as ContextOverflowError).cause).toBe(originalError);
  });

  test("should not wrap non-context-overflow 400 errors", () => {
    const originalError = {
      status: 400,
      message: "invalid request: something else went wrong",
      constructor: { name: "BadRequestError" },
    };

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).not.toBeInstanceOf(ContextOverflowError);
  });

  test("should still wrap tool_calls errors as INVALID_TOOL_RESULTS", () => {
    const originalError = {
      status: 400,
      message: "invalid tool_calls block",
      constructor: { name: "BadRequestError" },
    };

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).not.toBeInstanceOf(ContextOverflowError);
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("INVALID_TOOL_RESULTS");
  });

  test("should wrap 401 as MODEL_AUTHENTICATION", () => {
    const originalError = {
      status: 401,
      message: "Unauthorized",
      constructor: { name: "AuthenticationError" },
    };

    const wrapped = wrapOpenAIClientError(originalError);

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("MODEL_AUTHENTICATION");
  });

  test("should wrap 404 as MODEL_NOT_FOUND", () => {
    const originalError = {
      status: 404,
      message: "Not Found",
      constructor: { name: "NotFoundError" },
    };

    const wrapped = wrapOpenAIClientError(originalError);

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("MODEL_NOT_FOUND");
  });

  test("should wrap 429 as MODEL_RATE_LIMIT", () => {
    const originalError = {
      status: 429,
      message: "Too Many Requests",
      constructor: { name: "RateLimitError" },
    };

    const wrapped = wrapOpenAIClientError(originalError);

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("MODEL_RATE_LIMIT");
  });

  test("should pass through null/undefined", () => {
    expect(wrapOpenAIClientError(null)).toBeNull();
    expect(wrapOpenAIClientError(undefined)).toBeUndefined();
  });

  test("should pass through unrecognized errors", () => {
    const originalError = {
      status: 500,
      message: "Internal Server Error",
      constructor: { name: "InternalServerError" },
    };

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBe(originalError);
  });
});

describe("wrapOpenAIClientError retryability", () => {
  test("marks a connection timeout retryable", () => {
    const wrapped = wrapOpenAIClientError({
      message: "Request timed out.",
      constructor: { name: "APIConnectionTimeoutError" },
    });

    expect((wrapped as Error).name).toBe("TimeoutError");
    expect(getRetryable(wrapped)).toBe(true);
  });

  test("marks a user abort non-retryable", () => {
    const wrapped = wrapOpenAIClientError({
      message: "Request was aborted.",
      constructor: { name: "APIUserAbortError" },
    });

    expect((wrapped as Error).name).toBe("AbortError");
    expect(getRetryable(wrapped)).toBe(false);
  });

  test("marks context overflow non-retryable", () => {
    const wrapped = wrapOpenAIClientError({
      status: 400,
      message: "This model's maximum context length is 8192 tokens",
      constructor: { name: "BadRequestError" },
    });

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect(getRetryable(wrapped)).toBe(false);
  });

  test("marks invalid tool results non-retryable", () => {
    expect(
      getRetryable(
        wrapOpenAIClientError({
          status: 400,
          message: "invalid tool_calls block",
          constructor: { name: "BadRequestError" },
        })
      )
    ).toBe(false);
  });

  test("marks authentication failures non-retryable", () => {
    expect(
      getRetryable(
        wrapOpenAIClientError({
          status: 401,
          message: "Unauthorized",
          constructor: { name: "AuthenticationError" },
        })
      )
    ).toBe(false);
  });

  test("marks a missing model non-retryable", () => {
    expect(
      getRetryable(
        wrapOpenAIClientError({
          status: 404,
          message: "Not Found",
          constructor: { name: "NotFoundError" },
        })
      )
    ).toBe(false);
  });

  test("marks rate limits retryable", () => {
    expect(
      getRetryable(
        wrapOpenAIClientError({
          status: 429,
          message: "Too Many Requests",
          constructor: { name: "RateLimitError" },
        })
      )
    ).toBe(true);
  });

  test("leaves server errors unclassified so they still retry", () => {
    expect(
      getRetryable(
        wrapOpenAIClientError({
          status: 500,
          message: "Internal Server Error",
          constructor: { name: "InternalServerError" },
        })
      )
    ).toBeUndefined();
  });

  test("marks the original error in place without replacing it", () => {
    class APIError extends Error {
      status = 401;
    }
    const original = new APIError("Unauthorized");
    const wrapped = wrapOpenAIClientError(original);

    expect(wrapped).toBe(original);
    expect(wrapped).toBeInstanceOf(APIError);
    expect(getRetryable(wrapped)).toBe(false);
    expect(Object.keys(original as object)).not.toContain("isRetryable");
  });

  test("marking adds no enumerable property", () => {
    const raw = {
      status: 429,
      message: "Too Many Requests",
      constructor: { name: "RateLimitError" },
    };
    const before = Object.keys(raw);
    const wrapped = wrapOpenAIClientError(raw) as Record<string, unknown>;

    expect(getRetryable(wrapped)).toBe(true);
    expect(Object.keys(wrapped)).toEqual([...before, "lc_error_code"]);
  });
});
