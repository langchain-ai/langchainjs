import { expect, test } from "vitest";
import { convertFieldsToThinkingConfig } from "../params.js";

test.each(["gemini-4-argon", "gemini-10-pro", "gemini-3.8-flash"])(
  "%s downgrades minimal thinking",
  (model) => {
    expect(
      convertFieldsToThinkingConfig(model, { reasoningEffort: "minimal" })
    ).toMatchObject({ thinkingLevel: "LOW", includeThoughts: false });
    expect(
      convertFieldsToThinkingConfig(model, { maxReasoningTokens: 0 })
    ).toMatchObject({ thinkingLevel: "LOW", includeThoughts: false });
  }
);

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
