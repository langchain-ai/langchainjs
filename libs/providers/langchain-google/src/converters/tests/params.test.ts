import { expect, test } from "vitest";
import { convertFieldsToThinkingConfig } from "../params.js";

test.each(["gemma-4-pro", "gemini-2.5-flash", "gemini-unknown"])(
  "%s does not use the Gemini 3+ fallback",
  (model) => {
    expect(
      convertFieldsToThinkingConfig(model, { reasoningEffort: "minimal" })
    ).not.toMatchObject({ thinkingLevel: "LOW" });
  }
);

test.each([
  "gemini-4-argon",
  "gemini-4.1-pro",
  "gemini-10-pro",
  "gemini-3.8-flash",
])("%s downgrades minimal thinking", (model) => {
  expect(
    convertFieldsToThinkingConfig(model, { reasoningEffort: "minimal" })
  ).toMatchObject({ thinkingLevel: "LOW", includeThoughts: false });
  expect(
    convertFieldsToThinkingConfig(model, { maxReasoningTokens: 0 })
  ).toMatchObject({ thinkingLevel: "LOW", includeThoughts: false });
});

test.each([
  "gemini-3-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
])("%s preserves minimal thinking support", (model) => {
  expect(
    convertFieldsToThinkingConfig(model, { reasoningEffort: "minimal" })
  ).toMatchObject({ thinkingLevel: "MINIMAL" });
});
