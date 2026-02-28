import { describe, expect, test } from "vitest";
import { convertToolChoiceToGeminiConfig } from "../tools.js";

describe("convertToolChoiceToGeminiConfig", () => {
  test("returns undefined when toolChoice is undefined", () => {
    const result = convertToolChoiceToGeminiConfig(undefined, true);
    expect(result).toBeUndefined();
  });

  test("returns undefined when hasTools is false", () => {
    const result = convertToolChoiceToGeminiConfig("auto", false);
    expect(result).toBeUndefined();
  });

  test('maps "auto" to AUTO mode', () => {
    const result = convertToolChoiceToGeminiConfig("auto", true);
    expect(result).toEqual({
      functionCallingConfig: { mode: "AUTO" },
    });
  });

  test('maps "any" to ANY mode', () => {
    const result = convertToolChoiceToGeminiConfig("any", true);
    expect(result).toEqual({
      functionCallingConfig: { mode: "ANY" },
    });
  });

  test('maps "required" to ANY mode', () => {
    const result = convertToolChoiceToGeminiConfig("required", true);
    expect(result).toEqual({
      functionCallingConfig: { mode: "ANY" },
    });
  });

  test('maps "none" to NONE mode', () => {
    const result = convertToolChoiceToGeminiConfig("none", true);
    expect(result).toEqual({
      functionCallingConfig: { mode: "NONE" },
    });
  });

  test("maps a function name string to ANY mode with allowedFunctionNames", () => {
    const result = convertToolChoiceToGeminiConfig("my_function", true);
    expect(result).toEqual({
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: ["my_function"],
      },
    });
  });

  test("maps object with mode to corresponding Gemini mode", () => {
    const result = convertToolChoiceToGeminiConfig(
      { mode: "auto" } as never,
      true
    );
    expect(result).toEqual({
      functionCallingConfig: { mode: "AUTO" },
    });
  });

  test("maps object with function name to ANY with allowedFunctionNames", () => {
    const result = convertToolChoiceToGeminiConfig(
      { function: { name: "get_weather" } } as never,
      true
    );
    expect(result).toEqual({
      functionCallingConfig: {
        allowedFunctionNames: ["get_weather"],
      },
    });
  });
});
