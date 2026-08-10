import { test, expect, describe } from "vitest";
import {
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  ConflictError,
  RateLimitError as OpenAIRateLimitError,
  UnprocessableEntityError,
} from "openai";
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
import { InvalidToolResultsError, wrapOpenAIClientError } from "../errors.js";

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

describe("wrapOpenAIClientError", () => {
  test("wraps context overflow (context_length_exceeded code) as ContextOverflowError", () => {
    const originalError = generate(400, {
      error: {
        message:
          "This model's maximum context length is 8192 tokens. However, your messages resulted in 10000 tokens.",
        code: "context_length_exceeded",
      },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect((wrapped as ContextOverflowError).message).toContain(
      "maximum context length"
    );
    expect((wrapped as ContextOverflowError).cause).toBe(originalError);
    expect((wrapped as ContextOverflowError).isRetryable).toBe(false);
    expect((wrapped as ContextOverflowError).statusCode).toBe(400);
  });

  test("wraps context overflow (Input tokens exceed, no code) as ContextOverflowError", () => {
    const originalError = generate(400, {
      error: {
        message:
          "Input tokens exceed the configured limit of 272000 tokens. Your messages resulted in 300007 tokens.",
      },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect((wrapped as ContextOverflowError).message).toContain(
      "Input tokens exceed the configured limit"
    );
    expect((wrapped as ContextOverflowError).cause).toBe(originalError);
  });

  test("wraps context overflow (exceeds the context window)", () => {
    const originalError = generate(400, {
      error: {
        message:
          "Your input exceeds the context window of this model. Please adjust your input and try again.",
      },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect((wrapped as ContextOverflowError).message).toContain(
      "exceeds the context window"
    );
  });

  test("wraps context overflow (maximum context length)", () => {
    const originalError = generate(400, {
      error: {
        message:
          "This model's maximum context length is 131072 tokens. However, you requested 131079 tokens.",
      },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ContextOverflowError);
    expect((wrapped as ContextOverflowError).message).toContain(
      "maximum context length"
    );
  });

  test("does not wrap a generic 400 with no context-overflow/tool_calls signal", () => {
    const originalError = generate(400, {
      error: { message: "invalid request: something else went wrong" },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBe(originalError);
    expect(wrapped).not.toBeInstanceOf(ContextOverflowError);
  });

  test("wraps a tool_calls-related 400 as InvalidToolResultsError, not a ModelError", () => {
    const originalError = generate(400, {
      error: { message: "invalid tool_calls block" },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(InvalidToolResultsError);
    expect(wrapped).not.toBeInstanceOf(ModelError);
    expect((wrapped as InvalidToolResultsError).cause).toBe(originalError);
  });

  test("wraps 401 as AuthenticationError", () => {
    const originalError = generate(401, {
      error: { message: "Incorrect API key provided" },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(AuthenticationError);
    expect((wrapped as AuthenticationError).statusCode).toBe(401);
    expect((wrapped as AuthenticationError).isRetryable).toBe(false);
    expect((wrapped as AuthenticationError).cause).toBe(originalError);
  });

  test("wraps 403 as PermissionDeniedError", () => {
    const originalError = generate(403, {
      error: { message: "Country, region, or territory not supported" },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(PermissionDeniedError);
    expect((wrapped as PermissionDeniedError).cause).toBe(originalError);
  });

  test("wraps 404 as ModelNotFoundError", () => {
    const originalError = generate(404, {
      error: { message: "The model `gpt-nonexistent` does not exist" },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ModelNotFoundError);
    expect((wrapped as ModelNotFoundError).statusCode).toBe(404);
    expect((wrapped as ModelNotFoundError).cause).toBe(originalError);
  });

  test("wraps a plain rate-limit 429 as retryable RateLimitError with retryAfterMs from the header", () => {
    const originalError = generate(
      429,
      { error: { message: "Rate limit reached for requests" } },
      { "retry-after": "2" }
    );

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(RateLimitError);
    expect((wrapped as RateLimitError).isRetryable).toBe(true);
    expect((wrapped as RateLimitError).retryAfterMs).toBe(2000);
    expect((wrapped as RateLimitError).cause).toBe(originalError);

    // The whole point of preserving .cause: code that needs the raw SDK
    // type back (rather than our ModelError wrapper) can still get it —
    // `wrapped instanceof OpenAI.RateLimitError` is false, but this isn't.
    expect(wrapped).not.toBeInstanceOf(OpenAIRateLimitError);
    expect((wrapped as RateLimitError).cause).toBeInstanceOf(
      OpenAIRateLimitError
    );
  });

  test("wraps a quota-exhausted 429 as non-retryable RateLimitError", () => {
    const originalError = generate(429, {
      error: {
        message: "You exceeded your current quota",
        code: "insufficient_quota",
      },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(RateLimitError);
    expect((wrapped as RateLimitError).isRetryable).toBe(false);
  });

  test("wraps 500 as retryable ServerError", () => {
    const originalError = generate(500, {
      error: { message: "The server had an error while processing" },
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ServerError);
    expect((wrapped as ServerError).statusCode).toBe(500);
    expect((wrapped as ServerError).isRetryable).toBe(true);
    expect((wrapped as ServerError).cause).toBe(originalError);
  });

  test("wraps a network failure with no response as ConnectionError", () => {
    const originalError = new APIConnectionError({
      message: "Connection error.",
    });

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(ConnectionError);
    expect((wrapped as ConnectionError).isRetryable).toBe(true);
    expect((wrapped as ConnectionError).cause).toBe(originalError);
  });

  test("wraps a request timeout as TimeoutError", () => {
    const originalError = new APIConnectionTimeoutError();

    const wrapped = wrapOpenAIClientError(originalError);

    expect(wrapped).toBeInstanceOf(TimeoutError);
    expect(wrapped).not.toBeInstanceOf(ConnectionError);
    expect((wrapped as TimeoutError).cause).toBe(originalError);
  });

  test("wraps a user-initiated abort as ModelAbortError", () => {
    const originalError = new APIUserAbortError();

    const wrapped = wrapOpenAIClientError(originalError);

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

    expect(wrapOpenAIClientError(conflict)).toBe(conflict);
    expect(wrapOpenAIClientError(unprocessable)).toBe(unprocessable);
  });

  test("passes through null/undefined", () => {
    expect(wrapOpenAIClientError(null)).toBeNull();
    expect(wrapOpenAIClientError(undefined)).toBeUndefined();
  });
});
