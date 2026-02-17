import { test, expect, describe } from "vitest";
import { ContextOverflowError } from "@langchain/core/errors";
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
    expect((wrapped as ContextOverflowError).lc_error_code).toBe(
      "CONTEXT_OVERFLOW"
    );
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("INVALID_TOOL_RESULTS");
  });

  test("should wrap 401 as MODEL_AUTHENTICATION", () => {
    const originalError = { status: 401, message: "Unauthorized" };

    const wrapped = wrapAnthropicClientError(originalError);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("MODEL_AUTHENTICATION");
  });

  test("should wrap 404 as MODEL_NOT_FOUND", () => {
    const originalError = { status: 404, message: "Not Found" };

    const wrapped = wrapAnthropicClientError(originalError);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("MODEL_NOT_FOUND");
  });

  test("should wrap 429 as MODEL_RATE_LIMIT", () => {
    const originalError = { status: 429, message: "Too Many Requests" };

    const wrapped = wrapAnthropicClientError(originalError);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((wrapped as any).lc_error_code).toBe("MODEL_RATE_LIMIT");
  });

  test("should pass through unrecognized errors", () => {
    const originalError = { status: 500, message: "Internal Server Error" };

    const wrapped = wrapAnthropicClientError(originalError);

    expect(wrapped).toBe(originalError);
  });
});
