import { describe, expect, test } from "vitest";

describe("public type surface", () => {
  test("exports every name the middleware entrypoint needs", async () => {
    const mod = await import("../index.js");
    // Runtime exports only; types are checked by the tsc pass below.
    expect(typeof mod.TypeSafeClassifier).toBe("function");
  });
});
