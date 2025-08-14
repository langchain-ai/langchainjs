import { describe, it, expect } from "vitest";
import { stopWhen, stopWhenMaxSteps, stopWhenToolCall } from "../stopWhen";

describe("stopWhen", () => {
  describe("Input Validation", () => {
    it("Should throw for zero limit", () => {
      expect(() => stopWhenToolCall("pollJob", 0)).toThrow(
        "toolCallCount must be a positive integer"
      );
    });

    it("Should throw for negative limit", () => {
      expect(() => stopWhenToolCall("pollJob", -1)).toThrow(
        "toolCallCount must be a positive integer"
      );
    });

    it("Should throw for non-integer limit", () => {
      expect(() => stopWhenToolCall("pollJob", 2.5)).toThrow(
        "toolCallCount must be a positive integer"
      );
    });

    it("Should throw for zero max steps", () => {
      expect(() => stopWhenMaxSteps(0)).toThrow(
        "maxSteps must be a positive integer"
      );
    });

    it("Should throw for negative max steps", () => {
      expect(() => stopWhenMaxSteps(-5)).toThrow(
        "maxSteps must be a positive integer"
      );
    });

    it("should throw if stopWhen parameter is not a function", () => {
      // @ts-expect-error - we want to test the error case
      expect(() => stopWhen("not a function")).toThrow(
        "stopWhen must be a function"
      );
    });
  });
});
