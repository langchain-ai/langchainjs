import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ToolException } from "../tools.js";

describe("ToolException error formatting", () => {
  test("formats parsed Zod issues with their nested paths", () => {
    const result = z.object({ count: z.number() }).safeParse({ count: "one" });
    if (result.success) throw new Error("Expected invalid input");

    const error = new ToolException("Invalid hook result", result.error);
    expect(error.cause).toMatchObject({
      message: z.prettifyError(result.error),
    });
    expect(error.cause).not.toBe(result.error);
  });

  test("accepts the issue projection from another Zod implementation", () => {
    class ZodError extends Error {
      issues = [{ message: "Required", path: ["args", 0] }];
    }
    const cause = new ZodError("Verbose details");
    const error = new ToolException("Invalid hook result", cause);
    expect(error.cause).toMatchObject({
      message: "✖ Required\n  → at args[0]",
    });
  });

  test("preserves malformed error lookalikes instead of throwing while formatting", () => {
    class ZodError extends Error {
      issues = [{ message: 42, path: null }];
    }
    const cause = new ZodError("Malformed details");
    expect(new ToolException("Original failure", cause).cause).toBe(cause);
  });

  test("preserves ordinary and non-Error causes", () => {
    const cause = new Error("Connection failed");
    expect(new ToolException("Failure", cause).cause).toBe(cause);
    expect(new ToolException("Failure", null).cause).toBeNull();
    expect(new ToolException("Failure", false).cause).toBe(false);
  });
});
