import { expect, it } from "vitest";
import PROFILES from "../profiles.js";

it.each(["gpt-6-sol", "gpt-6-luna"])(
  "%s exposes its current model capabilities",
  (model) => {
    expect(PROFILES[model]).toMatchObject({
      maxInputTokens: 1050000,
      maxOutputTokens: 128000,
      reasoningOutput: true,
      imageInputs: true,
      pdfInputs: true,
      toolCalling: true,
      structuredOutput: true,
    });
  }
);
