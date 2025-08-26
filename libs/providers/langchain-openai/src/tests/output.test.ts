import { describe, it, expect } from "vitest";
import { getStructuredOutputMethod } from "../utils/structuredOutput.js";

describe("getStructuredOutputMethod", () => {
  it("should return the default method if no method is provided", () => {
    expect(getStructuredOutputMethod("gpt-4o-mini", undefined)).toBe(
      "jsonSchema"
    );
  });

  it("should default to functionCalling if the model does not support jsonSchema", () => {
    expect(getStructuredOutputMethod("gpt-3.5-turbo", undefined)).toBe(
      "functionCalling"
    );
  });

  it("should acknowledge the method if provided", () => {
    expect(getStructuredOutputMethod("gpt-4o-mini", "jsonSchema")).toBe(
      "jsonSchema"
    );
    expect(getStructuredOutputMethod("gpt-4o-mini", "functionCalling")).toBe(
      "functionCalling"
    );
    expect(getStructuredOutputMethod("gpt-4o-mini", "jsonMode")).toBe(
      "jsonMode"
    );
  });

  it("should throw an error if the method is invalid", () => {
    expect(() => getStructuredOutputMethod("gpt-4o-mini", "invalid")).toThrow();
    expect(() => getStructuredOutputMethod("gpt-4o-mini", null)).toThrow();
    expect(() => getStructuredOutputMethod("gpt-4o-mini", 1)).toThrow();
    expect(() => getStructuredOutputMethod("gpt-4o-mini", true)).toThrow();
    expect(() => getStructuredOutputMethod("gpt-4o-mini", false)).toThrow();
    expect(() => getStructuredOutputMethod("gpt-4o-mini", {})).toThrow();
    expect(() => getStructuredOutputMethod("gpt-4o-mini", [])).toThrow();
    expect(() => getStructuredOutputMethod("gpt-4o-mini", () => {})).toThrow();
  });
});
