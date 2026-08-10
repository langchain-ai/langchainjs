import { test, expect, describe } from "vitest";
import {
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  ConflictError,
  RateLimitError as AnthropicRateLimitError,
  UnprocessableEntityError,
} from "@anthropic-ai/sdk";
import {
  AuthenticationError,
  ConnectionError,
  ContextOverflowError,
  ModelAbortError,
  ModelError,
  ModelNotFoundError,
  PermissionDeniedError,
  RateLimitError,
  ServerError,
  TimeoutError,
} from "@langchain/core/errors";
import {
  InvalidToolResultsError,
  wrapAnthropicClientError,
} from "../errors.js";

function generate(
  status: number | undefined,
  body: Record<string, unknown> | undefined,
  headers?: Record<string, string>
) {
  return APIError.generate(
    status,
    body,
    undefined,
    new Headers(headers)
  ) as APIError;
}

// addLangChainErrorFields sets this dynamically; no wrapper class declares
// it, so read it through this shape instead of casting to `any`.
function lcErrorCode(error: unknown): string | undefined {
  return (error as { lc_error_code?: string }).lc_error_code;
}

describe("wrapAnthropicClientError", () => {
  test("wraps context overflow (prompt is too long) as ContextOverflowError", () => {
    const originalError = generate(400, {
      error: {
        message: "prompt is too long: 209752 tokens > 200000 maximum",
      },
    });

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect((wrapped as ContextOverflowError).message).toContain(
      "prompt is too long"
    );
    expect((wrapped as ContextOverflowError).cause).toBe(originalError);
    expect((wrapped as ContextOverflowError).isRetryable).toBe(false);
    expect((wrapped as ContextOverflowError).statusCode).toBe(400);
    expect(lcErrorCode(wrapped)).toBe("CONTEXT_OVERFLOW");
  });

  test("does not wrap a generic 400 with no context-overflow/tool signal", () => {
    const originalError = generate(400, {
      error: { message: "invalid request: something else went wrong" },
    });

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBe(originalError);
    expect(wrapped).not.toBeInstanceOf(ContextOverflowError);
  });

  test("wraps a tool-related 400 as InvalidToolResultsError, not a ModelError", () => {
    const originalError = generate(400, {
      error: { message: "invalid tool_use block" },
    });

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(InvalidToolResultsError);
    expect(wrapped).not.toBeInstanceOf(ModelError);
    expect((wrapped as InvalidToolResultsError).cause).toBe(originalError);
    expect(lcErrorCode(wrapped)).toBe("INVALID_TOOL_RESULTS");
    expect((wrapped as InvalidToolResultsError).message).toContain(
      "Troubleshooting URL"
    );
    // Not a ModelError by design, but AsyncCaller's own retry-suppression
    // duck-types on status code independently of ModelError.
    expect((wrapped as InvalidToolResultsError).statusCode).toBe(400);
  });

  test("wraps 401 as AuthenticationError", () => {
    const originalError = generate(401, {
      error: { message: "invalid x-api-key" },
    });

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(AuthenticationError);
    expect((wrapped as AuthenticationError).statusCode).toBe(401);
    expect((wrapped as AuthenticationError).isRetryable).toBe(false);
    expect((wrapped as AuthenticationError).cause).toBe(originalError);
    expect(lcErrorCode(wrapped)).toBe("MODEL_AUTHENTICATION");
  });

  test("wraps 403 as PermissionDeniedError", () => {
    const originalError = generate(403, {
      error: { message: "Permission denied" },
    });

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(PermissionDeniedError);
    expect((wrapped as PermissionDeniedError).cause).toBe(originalError);
    expect(lcErrorCode(wrapped)).toBeUndefined();
  });

  test("wraps 404 as ModelNotFoundError", () => {
    const originalError = generate(404, {
      error: { message: "model: claude-nonexistent" },
    });

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(ModelNotFoundError);
    expect((wrapped as ModelNotFoundError).statusCode).toBe(404);
    expect((wrapped as ModelNotFoundError).cause).toBe(originalError);
    expect(lcErrorCode(wrapped)).toBe("MODEL_NOT_FOUND");
  });

  test("wraps a plain rate-limit 429 as retryable RateLimitError with retryAfterMs from the header", () => {
    const originalError = generate(
      429,
      { error: { message: "Number of request tokens exceeds rate limit" } },
      { "retry-after": "2" }
    );

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(RateLimitError);
    expect((wrapped as RateLimitError).isRetryable).toBe(true);
    expect((wrapped as RateLimitError).retryAfterMs).toBe(2000);
    expect((wrapped as RateLimitError).cause).toBe(originalError);

    expect(wrapped).not.toBeInstanceOf(AnthropicRateLimitError);
    expect((wrapped as RateLimitError).cause).toBeInstanceOf(
      AnthropicRateLimitError
    );
    expect(lcErrorCode(wrapped)).toBe("MODEL_RATE_LIMIT");
  });

  test("wraps a billing-exhausted 429 as non-retryable RateLimitError", () => {
    const originalError = generate(429, {
      error: { message: "Your credit balance is too low to access the API" },
    });

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(RateLimitError);
    expect((wrapped as RateLimitError).isRetryable).toBe(false);
    expect(lcErrorCode(wrapped)).toBe("MODEL_RATE_LIMIT");
  });

  test("wraps 500 as retryable ServerError", () => {
    const originalError = generate(500, {
      error: { message: "Internal server error" },
    });

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(ServerError);
    expect((wrapped as ServerError).statusCode).toBe(500);
    expect((wrapped as ServerError).isRetryable).toBe(true);
    expect((wrapped as ServerError).cause).toBe(originalError);
    expect(lcErrorCode(wrapped)).toBeUndefined();
  });

  test("wraps 529 (overloaded) as retryable ServerError", () => {
    const originalError = generate(529, {
      error: { message: "Overloaded" },
    });

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(ServerError);
    expect((wrapped as ServerError).statusCode).toBe(529);
    expect((wrapped as ServerError).isRetryable).toBe(true);
    expect((wrapped as ServerError).cause).toBe(originalError);
  });

  test("wraps a network failure with no response as ConnectionError", () => {
    const originalError = new APIConnectionError({
      message: "Connection error.",
    });

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(ConnectionError);
    expect((wrapped as ConnectionError).isRetryable).toBe(true);
    expect((wrapped as ConnectionError).cause).toBe(originalError);
  });

  test("wraps a request timeout as TimeoutError", () => {
    const originalError = new APIConnectionTimeoutError();

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(TimeoutError);
    expect(wrapped).not.toBeInstanceOf(ConnectionError);
    expect((wrapped as TimeoutError).cause).toBe(originalError);
  });

  test("wraps a user-initiated abort as ModelAbortError", () => {
    const originalError = new APIUserAbortError();

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBeInstanceOf(ModelAbortError);
    expect((wrapped as ModelAbortError).isRetryable).toBe(false);
    expect((wrapped as ModelAbortError).cause).toBe(originalError);
  });

  test("does not wrap 409 or 422 — no clean fit in the shared hierarchy", () => {
    const conflict = new ConflictError(
      409,
      { error: { message: "conflict" } },
      "conflict",
      new Headers()
    );
    const unprocessable = new UnprocessableEntityError(
      422,
      { error: { message: "unprocessable" } },
      "unprocessable",
      new Headers()
    );

    expect(wrapAnthropicClientError(conflict)).toBe(conflict);
    expect(wrapAnthropicClientError(unprocessable)).toBe(unprocessable);
  });

  test("passes through null/undefined", () => {
    expect(wrapAnthropicClientError(null)).toBeNull();
    expect(wrapAnthropicClientError(undefined)).toBeUndefined();
  });
});
