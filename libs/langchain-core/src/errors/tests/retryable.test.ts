import { describe, test, expect } from "vitest";
import {
  ContextOverflowError,
  ModelAbortError,
  getRetryable,
  stampRetryable,
} from "../index.js";

describe("stampRetryable", () => {
  test("marks an error retryable", () => {
    expect(getRetryable(stampRetryable(new Error("boom"), true))).toBe(true);
  });

  test("marks an error non-retryable", () => {
    expect(getRetryable(stampRetryable(new Error("boom"), false))).toBe(false);
  });

  test("returns the same instance and preserves the prototype", () => {
    class SdkError extends Error {}
    const original = new SdkError("boom");
    const stamped = stampRetryable(original, false);

    expect(stamped).toBe(original);
    expect(stamped).toBeInstanceOf(SdkError);
    expect(stamped.name).toBe("Error");
    expect(stamped.message).toBe("boom");
  });

  test("mark is invisible to enumeration and serialization", () => {
    const error = stampRetryable(
      Object.assign(new Error("boom"), { status: 429 }),
      true
    );

    expect(Object.keys(error)).toEqual(["status"]);
    expect(JSON.stringify(error)).toBe('{"status":429}');
    expect({ ...error }).toEqual({ status: 429 });
  });

  test("can be re-stamped with a different verdict", () => {
    const error = stampRetryable(new Error("boom"), true);

    expect(getRetryable(stampRetryable(error, false))).toBe(false);
  });

  test("does not throw on non-objects", () => {
    expect(() => stampRetryable(null, true)).not.toThrow();
    expect(() => stampRetryable(undefined, true)).not.toThrow();
    expect(() => stampRetryable("boom", true)).not.toThrow();
    expect(stampRetryable("boom", true)).toBe("boom");
  });

  test("does not throw on a frozen error", () => {
    const frozen = Object.freeze(new Error("boom"));

    expect(() => stampRetryable(frozen, false)).not.toThrow();
    expect(getRetryable(frozen)).toBeUndefined();
  });

  test("uses the global symbol registry", () => {
    const error = stampRetryable(new Error("boom"), true);
    const symbol = Symbol.for("langchain.errors.retryable");

    expect((error as unknown as Record<symbol, unknown>)[symbol]).toBe(true);
  });
});

describe("getRetryable", () => {
  test("returns undefined for an unclassified error", () => {
    expect(getRetryable(new Error("boom"))).toBeUndefined();
  });

  test("returns undefined for non-objects", () => {
    expect(getRetryable(null)).toBeUndefined();
    expect(getRetryable(undefined)).toBeUndefined();
    expect(getRetryable("boom")).toBeUndefined();
    expect(getRetryable(429)).toBeUndefined();
  });
});

describe("core error classification", () => {
  test("ModelAbortError is non-retryable", () => {
    expect(getRetryable(new ModelAbortError("aborted"))).toBe(false);
  });

  test("ContextOverflowError is non-retryable", () => {
    expect(getRetryable(new ContextOverflowError())).toBe(false);
  });

  test("ContextOverflowError.fromError is non-retryable", () => {
    expect(
      getRetryable(ContextOverflowError.fromError(new Error("too long")))
    ).toBe(false);
  });

  test("ContextOverflowError.fromError preserves the underlying status", () => {
    const original = Object.assign(
      new Error("prompt is too long: 1373536 tokens > 1000000 maximum"),
      { status: 400 }
    );
    const wrapped = ContextOverflowError.fromError(original);

    expect(wrapped.status).toBe(400);
    expect(wrapped.cause).toBe(original);
  });

  test("ContextOverflowError.fromError preserves statusCode when status is absent", () => {
    const original = Object.assign(new Error("too long"), { statusCode: 429 });
    const wrapped = ContextOverflowError.fromError(original);

    expect(wrapped.status).toBe(429);
  });

  test("ContextOverflowError.fromError leaves status undefined for plain errors", () => {
    const wrapped = ContextOverflowError.fromError(new Error("too long"));

    expect(wrapped.status).toBeUndefined();
  });
});
