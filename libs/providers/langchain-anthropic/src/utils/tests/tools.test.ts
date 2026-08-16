import { test, expect, describe } from "vitest";
import { handleToolChoice } from "../tools.js";

describe("handleToolChoice", () => {
  test("should return undefined for undefined input", () => {
    const result = handleToolChoice(undefined);
    expect(result).toBeUndefined();
  });

  test("should handle 'any' tool choice", () => {
    const result = handleToolChoice("any");
    expect(result).toEqual({ type: "any" });
  });

  test("should handle 'required' tool choice by mapping to 'any'", () => {
    // "required" is OpenAI-style, should map to Anthropic's "any"
    const result = handleToolChoice("required");
    expect(result).toEqual({ type: "any" });
  });

  test("should handle 'auto' tool choice", () => {
    const result = handleToolChoice("auto");
    expect(result).toEqual({ type: "auto" });
  });

  test("should handle 'none' tool choice", () => {
    const result = handleToolChoice("none");
    expect(result).toEqual({ type: "none" });
  });

  test("should handle specific tool name as string", () => {
    const result = handleToolChoice("my_custom_tool");
    expect(result).toEqual({ type: "tool", name: "my_custom_tool" });
  });

  test("should pass through object tool choice", () => {
    const toolChoice = { type: "tool" as const, name: "specific_tool" };
    const result = handleToolChoice(toolChoice);
    expect(result).toEqual(toolChoice);
  });
});
