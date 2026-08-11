import { describe, expect, test } from "vitest";
import { getRetryable, stampRetryable } from "@langchain/core/errors";
import {
  createFireworksResponseError,
  wrapFireworksModelError,
} from "../errors.js";

describe("createFireworksResponseError", () => {
  test("exposes the status as a field", () => {
    const error = createFireworksResponseError(429, "rate limited");

    expect((error as Error & { status: number }).status).toBe(429);
  });

  test("keeps the original message format", () => {
    expect(createFireworksResponseError(401, "unauthorized").message).toBe(
      "Error 401: unauthorized"
    );
  });

  test.each([400, 401, 402, 403, 404, 413])(
    "marks status %i non-retryable",
    (status) => {
      expect(getRetryable(createFireworksResponseError(status, "nope"))).toBe(
        false
      );
    }
  );

  test.each([408, 429, 500, 502, 503, 504])(
    "marks status %i retryable",
    (status) => {
      expect(getRetryable(createFireworksResponseError(status, "later"))).toBe(
        true
      );
    }
  );

  test("leaves an unmapped status unclassified", () => {
    expect(
      getRetryable(createFireworksResponseError(418, "teapot"))
    ).toBeUndefined();
  });
});

describe("wrapFireworksModelError", () => {
  test.each([402, 413])(
    "marks Fireworks-specific status %i non-retryable",
    (status) => {
      const error = Object.assign(new Error("nope"), { status });

      expect(getRetryable(wrapFireworksModelError(error))).toBe(false);
    }
  );

  test("marks a 408 timeout retryable", () => {
    const error = Object.assign(new Error("timed out"), { status: 408 });

    expect(getRetryable(wrapFireworksModelError(error))).toBe(true);
  });

  test("does not override an existing mark", () => {
    const error = stampRetryable(
      Object.assign(new Error("nope"), { status: 402 }),
      true
    );

    expect(getRetryable(wrapFireworksModelError(error))).toBe(true);
  });

  test("reads statusCode when status is absent", () => {
    const error = Object.assign(new Error("nope"), { statusCode: 413 });

    expect(getRetryable(wrapFireworksModelError(error))).toBe(false);
  });

  test("passes through errors with no status", () => {
    const error = new Error("who knows");

    expect(wrapFireworksModelError(error)).toBe(error);
    expect(getRetryable(error)).toBeUndefined();
  });

  test("passes through non-objects", () => {
    expect(wrapFireworksModelError(null)).toBeNull();
    expect(wrapFireworksModelError("boom")).toBe("boom");
  });

  test("returns the same instance and adds no enumerable property", () => {
    const error = Object.assign(new Error("nope"), { status: 402 });
    const wrapped = wrapFireworksModelError(error);

    expect(wrapped).toBe(error);
    expect(Object.keys(error)).toEqual(["status"]);
  });
});
