import { describe, expect, test } from "vitest";
import { AIMessageChunk } from "../../messages/ai.js";
import {
  AuthenticationError,
  ConfigurationError,
  ConnectionError,
  ModelError,
  ModelNotFoundError,
  PermissionDeniedError,
  QuotaExceededError,
  RateLimitError,
  ServerError,
  TimeoutError,
} from "../index.js";

describe("ConfigurationError", () => {
  test("is not a ModelError — it sits outside that subtree by design", () => {
    expect(new ConfigurationError("bad config")).not.toBeInstanceOf(ModelError);
  });
});

describe("AuthenticationError", () => {
  test("is retryable for a transient status from the auth server", () => {
    expect(new AuthenticationError("rate limited", 429).isRetryable).toBe(true);
    expect(new AuthenticationError("server error", 503).isRetryable).toBe(true);
  });

  test("is not retryable for an actual credential failure", () => {
    expect(new AuthenticationError("bad key", 401).isRetryable).toBe(false);
    expect(new AuthenticationError("no status code").isRetryable).toBe(false);
  });
});

describe("TimeoutError / RateLimitError / ConnectionError / ServerError", () => {
  test("are retryable by default", () => {
    expect(new TimeoutError().isRetryable).toBe(true);
    expect(new RateLimitError().isRetryable).toBe(true);
    expect(new ConnectionError().isRetryable).toBe(true);
    expect(new ServerError().isRetryable).toBe(true);
  });

  test("are not retryable if output already streamed before the failure", () => {
    const partialOutput = new AIMessageChunk("partial");
    expect(new TimeoutError(undefined, partialOutput).isRetryable).toBe(false);
    expect(new RateLimitError(undefined, { partialOutput }).isRetryable).toBe(
      false
    );
    expect(new ConnectionError(undefined, partialOutput).isRetryable).toBe(
      false
    );
    expect(new ServerError(undefined, { partialOutput }).isRetryable).toBe(
      false
    );
  });

  test("RateLimitError carries retryAfterMs and statusCode when provided", () => {
    const error = new RateLimitError(undefined, {
      retryAfterMs: 5000,
      statusCode: 429,
    });
    expect(error.retryAfterMs).toBe(5000);
    expect(error.statusCode).toBe(429);
  });

  test("RateLimitError is not retryable when quota is exhausted", () => {
    expect(
      new RateLimitError(undefined, { quotaExhausted: true }).isRetryable
    ).toBe(false);
  });

  test("ModelNotFoundError carries statusCode when provided", () => {
    const error = new ModelNotFoundError(undefined, 404);
    expect(error.statusCode).toBe(404);
  });

  test("ServerError carries statusCode when provided", () => {
    const error = new ServerError(undefined, { statusCode: 503 });
    expect(error.statusCode).toBe(503);
  });
});

describe("ModelNotFoundError / PermissionDeniedError / QuotaExceededError", () => {
  test("are always non-retryable", () => {
    expect(new ModelNotFoundError().isRetryable).toBe(false);
    expect(new PermissionDeniedError().isRetryable).toBe(false);
    expect(new QuotaExceededError().isRetryable).toBe(false);
  });
});

describe("ModelError subclasses", () => {
  test("all new classes are instances of ModelError", () => {
    expect(new AuthenticationError("x")).toBeInstanceOf(ModelError);
    expect(new ModelNotFoundError()).toBeInstanceOf(ModelError);
    expect(new TimeoutError()).toBeInstanceOf(ModelError);
    expect(new RateLimitError()).toBeInstanceOf(ModelError);
    expect(new ConnectionError()).toBeInstanceOf(ModelError);
    expect(new ServerError()).toBeInstanceOf(ModelError);
    expect(new PermissionDeniedError()).toBeInstanceOf(ModelError);
    expect(new QuotaExceededError()).toBeInstanceOf(ModelError);
  });
});
