import { describe, expect, test } from "vitest";
import { getRetryable } from "@langchain/core/errors";
import { normalizeBedrockError } from "../errors.js";

describe("normalizeBedrockError", () => {
  test("preserves plain object error properties and cause", () => {
    const source = {
      message: "Service unavailable",
      code: "ECONNRESET",
      $retryable: { throttling: false },
      $metadata: { httpStatusCode: 503 },
    };
    const error = normalizeBedrockError(source);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ ...source, status: 503 });
    expect(error.cause).toBe(source);
  });

  test("preserves existing status and error identity", () => {
    const source = Object.assign(new Error("Invalid request"), {
      status: 400,
      $metadata: { httpStatusCode: 503 },
    });

    expect(normalizeBedrockError(source)).toBe(source);
    expect(source.status).toBe(400);
  });

  test.each(["ThrottlingException", "ModelNotReadyException"])(
    "preserves the name of a plain object %s without attaching status 429",
    (name) => {
      const source = {
        name,
        message: "Try again",
        $metadata: { httpStatusCode: 429 },
      };
      const error = normalizeBedrockError(source);

      expect(error).toMatchObject(source);
      expect(error).not.toHaveProperty("status");
    }
  );

  test.each([
    new Error("Blocked by the CONTENT FILTERING POLICY"),
    { Message: "Blocked by the content filtering policy" },
    { errors: [{ message: "Blocked by the content filtering policy" }] },
  ])("marks content-filter errors as non-retryable: %s", (source) => {
    expect(getRetryable(normalizeBedrockError(source))).toBe(false);
  });

  test("does not replace a non-extensible error", () => {
    const source = Object.freeze(
      Object.assign(new Error("Invalid request"), {
        $metadata: { httpStatusCode: 400 },
      })
    );

    expect(normalizeBedrockError(source)).toBe(source);
  });
});
