import { describe, it, expect } from "vitest";
import { resolveOpenRouterStructuredOutputMethod } from "../structured_output.js";

const base = { model: "test/model", method: undefined, profile: {} };

describe("resolveOpenRouterStructuredOutputMethod", () => {
  describe("explicit method validation", () => {
    it("throws on an unsupported method", () => {
      expect(() =>
        resolveOpenRouterStructuredOutputMethod({
          ...base,
          method: "banana",
        })
      ).toThrow(/Invalid structured output method.*banana/);
    });

    it("throws when jsonSchema is requested but profile lacks structuredOutput", () => {
      expect(() =>
        resolveOpenRouterStructuredOutputMethod({
          ...base,
          method: "jsonSchema",
          profile: { structuredOutput: false },
        })
      ).toThrow(/not supported for model/);
    });

    it("returns jsonSchema when profile supports it", () => {
      expect(
        resolveOpenRouterStructuredOutputMethod({
          ...base,
          method: "jsonSchema",
          profile: { structuredOutput: true },
        })
      ).toBe("jsonSchema");
    });

    it("returns functionCalling when explicitly requested", () => {
      expect(
        resolveOpenRouterStructuredOutputMethod({
          ...base,
          method: "functionCalling",
        })
      ).toBe("functionCalling");
    });

    it("returns jsonMode when explicitly requested", () => {
      expect(
        resolveOpenRouterStructuredOutputMethod({
          ...base,
          method: "jsonMode",
        })
      ).toBe("jsonMode");
    });
  });

  describe("auto-detect with routing", () => {
    it("falls back to functionCalling when models list is provided", () => {
      expect(
        resolveOpenRouterStructuredOutputMethod({
          ...base,
          models: ["model-a", "model-b"],
          profile: { structuredOutput: true },
        })
      ).toBe("functionCalling");
    });

    it("falls back to functionCalling when route is fallback", () => {
      expect(
        resolveOpenRouterStructuredOutputMethod({
          ...base,
          route: "fallback",
          profile: { structuredOutput: true },
        })
      ).toBe("functionCalling");
    });
  });

  describe("auto-detect based on profile", () => {
    it("returns jsonSchema when profile has structuredOutput: true", () => {
      expect(
        resolveOpenRouterStructuredOutputMethod({
          ...base,
          profile: { structuredOutput: true },
        })
      ).toBe("jsonSchema");
    });

    it("returns functionCalling when profile has structuredOutput: false", () => {
      expect(
        resolveOpenRouterStructuredOutputMethod({
          ...base,
          profile: { structuredOutput: false },
        })
      ).toBe("functionCalling");
    });

    it("returns functionCalling when profile is empty", () => {
      expect(
        resolveOpenRouterStructuredOutputMethod({ ...base, profile: {} })
      ).toBe("functionCalling");
    });
  });
});
