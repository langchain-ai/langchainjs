import { expect, test } from "vitest";
import PROFILES from "../profiles.js";

test("Gemini 4 Argon capabilities", () => {
  expect(PROFILES["gemini-4-argon"]).toMatchObject({
    maxInputTokens: 1048576,
    maxOutputTokens: 65536,
    temperature: false,
    imageInputs: true,
    audioInputs: true,
    videoInputs: true,
    pdfInputs: true,
    reasoningOutput: true,
    toolCalling: true,
    structuredOutput: true,
  });
});
