import { describe, it, expect } from "vitest";
import { ConfigurableModel } from "../../chat_models/universal.js";
import { isConfigurableModel } from "../model.js";

describe("isConfigurableModel", () => {
  it("should return true for a ConfigurableModel instance", () => {
    const model = new ConfigurableModel({});
    expect(isConfigurableModel(model)).toBe(true);
  });

  it("should return false for a plain object", () => {
    const model = {};
    expect(isConfigurableModel(model)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isConfigurableModel(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isConfigurableModel(undefined)).toBe(false);
  });

  it("should return false for an object missing required properties", () => {
    const model = {
      _queuedMethodOperations: {},
      // Missing _getModelInstance
    };
    expect(isConfigurableModel(model)).toBe(false);
  });
});
