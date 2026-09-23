import { expect, it } from "vitest";
import PROFILES from "../profiles.js";

it.each(["claude-opus-5-5", "claude-fable-5-1"])(
  "%s supports native structured output but not forced tool choice",
  (model) => {
    expect(PROFILES[model]).toMatchObject({
      maxInputTokens: 1000000,
      maxOutputTokens: 128000,
      reasoningOutput: true,
      toolCalling: true,
      structuredOutput: true,
      toolChoice: false,
    });
  }
);
