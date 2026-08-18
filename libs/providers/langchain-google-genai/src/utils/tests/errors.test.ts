import { describe, expect, test } from "vitest";
import { LangChainError, getRetryable } from "@langchain/core/errors";
import { ContentBlockedError } from "../errors.js";

describe("ContentBlockedError", () => {
  test("is a LangChainError and reports as such via isInstance", () => {
    const error = new ContentBlockedError({ finishReason: "SAFETY" });

    expect(error).toBeInstanceOf(LangChainError);
    expect(ContentBlockedError.isInstance(error)).toBe(true);
    expect(LangChainError.isInstance(error)).toBe(true);
  });

  test("is marked non-retryable", () => {
    const error = new ContentBlockedError({ finishReason: "SAFETY" });

    expect(getRetryable(error)).toBe(false);
  });

  test("default message includes the finish reason", () => {
    const error = new ContentBlockedError({
      finishReason: "MALFORMED_FUNCTION_CALL",
    });

    expect(error.finishReason).toBe("MALFORMED_FUNCTION_CALL");
    expect(error.blockReason).toBeUndefined();
    expect(error.message).toContain("MALFORMED_FUNCTION_CALL");
  });

  test("default message includes the block reason", () => {
    const error = new ContentBlockedError({ blockReason: "SAFETY" });

    expect(error.blockReason).toBe("SAFETY");
    expect(error.finishReason).toBeUndefined();
    expect(error.message).toContain("SAFETY");
  });

  test("default message includes both reasons when both are present", () => {
    const error = new ContentBlockedError({
      blockReason: "SAFETY",
      finishReason: "OTHER",
    });

    expect(error.message).toContain("Block reason: SAFETY");
    expect(error.message).toContain("Finish reason: OTHER");
  });

  test("falls back to a generic message when no reason is given", () => {
    const error = new ContentBlockedError();

    expect(error.message).toBe("The model returned no content.");
  });

  test("a custom message overrides the generated one", () => {
    const error = new ContentBlockedError({
      finishReason: "SAFETY",
      message: "custom message",
    });

    expect(error.message).toBe("custom message");
  });
});
