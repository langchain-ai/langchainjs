import { describe, expect, test } from "vitest";
import { AIMessageChunk } from "../../messages/ai.js";
import {
  AuthenticationError,
  ConfigurationError,
  ConnectionError,
  ContextOverflowError,
  LangChainError,
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

describe("ModelError branding", () => {
  test("isInstance does not match every LangChainError — only its own subtree", () => {
    // Regression test: a markerless ns.brand() call reuses the parent's own
    // symbol rather than minting a new one, so ModelError.isInstance() must
    // not accidentally match ConfigurationError/LangChainError/other
    // provider errors that never touched this subtree — that would make
    // defaultRetryOn read a nonexistent `isRetryable` off them and silently
    // stop retrying errors that used to always retry.
    expect(ModelError.isInstance(new ConfigurationError("bad config"))).toBe(
      false
    );
    expect(ModelError.isInstance(new LangChainError("generic"))).toBe(false);
    expect(ModelError.isInstance(new AuthenticationError("x"))).toBe(true);
  });
});

describe("ModelError.cause", () => {
  test("preserves instanceof-checkability of the wrapped error via .cause", () => {
    class FakeProviderRateLimitError extends Error {
      status = 429;
    }

    const original = new FakeProviderRateLimitError("slow down");
    const wrapped = new RateLimitError("Rate limited", { statusCode: 429 });
    wrapped.cause = original;

    expect(wrapped).not.toBeInstanceOf(FakeProviderRateLimitError);
    expect(wrapped.cause).toBeInstanceOf(FakeProviderRateLimitError);
    expect((wrapped.cause as FakeProviderRateLimitError).status).toBe(429);
  });

  test("is undefined when the error wasn't constructed from another error", () => {
    expect(new RateLimitError("Rate limited").cause).toBeUndefined();
  });
});

describe("ContextOverflowError", () => {
  test("fromError copies status/statusCode from the wrapped error", () => {
    const withStatus = ContextOverflowError.fromError(
      Object.assign(new Error("prompt is too long"), { status: 400 })
    );
    expect(withStatus.statusCode).toBe(400);

    const withStatusCode = ContextOverflowError.fromError(
      Object.assign(new Error("prompt is too long"), { statusCode: 400 })
    );
    expect(withStatusCode.statusCode).toBe(400);
  });

  test("fromError leaves statusCode undefined when the wrapped error has none", () => {
    const error = ContextOverflowError.fromError(new Error("too long"));
    expect(error.statusCode).toBeUndefined();
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
