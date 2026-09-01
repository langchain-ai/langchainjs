import { describe, expect, test } from "vitest";
import { getRetryable } from "@langchain/core/errors";
import { createFireworksResponseError } from "../errors.js";

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
