import { describe, it, expect } from "vitest";
import { separateOverrides, applyOverrides } from "../config.js";

describe("config", () => {
  describe("separateOverrides", () => {
    it("should separate provider-level and model-specific overrides", () => {
      const overrides = {
        maxInputTokens: 100000,
        toolCalling: true,
        "gpt-4": {
          maxOutputTokens: 8192,
        },
        "gpt-3.5-turbo": {
          maxInputTokens: 16385,
        },
      };

      const { providerOverrides, modelOverrides } =
        separateOverrides(overrides);

      expect(providerOverrides).toEqual({
        maxInputTokens: 100000,
        toolCalling: true,
      });
      expect(modelOverrides).toEqual({
        "gpt-4": {
          maxOutputTokens: 8192,
        },
        "gpt-3.5-turbo": {
          maxInputTokens: 16385,
        },
      });
    });

    it("should handle empty overrides", () => {
      const { providerOverrides, modelOverrides } = separateOverrides();

      expect(providerOverrides).toEqual({});
      expect(modelOverrides).toEqual({});
    });

    it("should handle undefined overrides", () => {
      const { providerOverrides, modelOverrides } =
        separateOverrides(undefined);

      expect(providerOverrides).toEqual({});
      expect(modelOverrides).toEqual({});
    });

    it("should only include valid ModelProfile fields in provider overrides", () => {
      const overrides = {
        maxInputTokens: 100000,
        invalidField: "should be ignored",
        "gpt-4": {
          maxOutputTokens: 8192,
        },
      };

      const { providerOverrides, modelOverrides } =
        separateOverrides(overrides);

      expect(providerOverrides).toEqual({
        maxInputTokens: 100000,
      });
      expect(providerOverrides).not.toHaveProperty("invalidField");
      expect(modelOverrides).toEqual({
        "gpt-4": {
          maxOutputTokens: 8192,
        },
      });
    });
  });

  describe("applyOverrides", () => {
    it("should apply provider overrides to base profile", () => {
      const baseProfile = {
        maxInputTokens: 1000,
        toolCalling: false,
      };

      const providerOverrides = {
        maxInputTokens: 2000,
        toolCalling: true,
      };

      const result = applyOverrides(baseProfile, providerOverrides);

      expect(result).toEqual({
        maxInputTokens: 2000,
        toolCalling: true,
      });
    });

    it("should apply model-specific overrides after provider overrides", () => {
      const baseProfile = {
        maxInputTokens: 1000,
        maxOutputTokens: 500,
        toolCalling: false,
      };

      const providerOverrides = {
        maxInputTokens: 2000,
        toolCalling: true,
      };

      const modelOverrides = {
        maxOutputTokens: 1000,
      };

      const result = applyOverrides(
        baseProfile,
        providerOverrides,
        modelOverrides
      );

      expect(result).toEqual({
        maxInputTokens: 2000, // From provider override
        maxOutputTokens: 1000, // From model override
        toolCalling: true, // From provider override
      });
    });

    it("should return base profile if no overrides provided", () => {
      const baseProfile = {
        maxInputTokens: 1000,
        toolCalling: false,
      };

      const result = applyOverrides(baseProfile);

      expect(result).toEqual(baseProfile);
    });

    it("should handle model-specific overrides overriding provider overrides", () => {
      const baseProfile = {
        maxInputTokens: 1000,
      };

      const providerOverrides = {
        maxInputTokens: 2000,
      };

      const modelOverrides = {
        maxInputTokens: 3000, // Should override provider override
      };

      const result = applyOverrides(
        baseProfile,
        providerOverrides,
        modelOverrides
      );

      expect(result).toEqual({
        maxInputTokens: 3000,
      });
    });
  });
});
