import { describe, expect, it } from "vitest";
import { toolArgumentsTextForTokenCount } from "../tool_arguments_token_count.js";

describe("toolArgumentsTextForTokenCount", () => {
  it("returns compact JSON unchanged", () => {
    const compact = '{"location":"San Francisco"}';
    expect(toolArgumentsTextForTokenCount(compact)).toEqual({
      text: compact,
      parseFailed: false,
    });
  });

  it("normalizes whitespace outside of strings", () => {
    const pretty = '{\n  "location": "San Francisco"\n}';
    expect(toolArgumentsTextForTokenCount(pretty)).toEqual({
      text: '{"location":"San Francisco"}',
      parseFailed: false,
    });
  });

  it("keeps pretty-printed JSON when parse fails", () => {
    const bad = "{\n  broken:\n}";
    expect(toolArgumentsTextForTokenCount(bad)).toEqual({
      text: bad,
      parseFailed: true,
    });
  });
});