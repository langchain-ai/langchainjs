import { test } from "@jest/globals";
import { GooglePaLM } from "../googlepalm.js";

test("Google Palm - `temperature` must be in range [0.0,1.0]", async () => {
  expect(
    () =>
      new GooglePaLM({
        temperature: -1.0,
      })
  ).toThrow();
  expect(
    () =>
      new GooglePaLM({
        temperature: 1.1,
      })
  ).toThrow();
});

test("Google Palm - `maxOutputTokens` must be positive", async () => {
  expect(
    () =>
      new GooglePaLM({
        maxOutputTokens: -1,
      })
  ).toThrow();
});

test("Google Palm - `topP` must be positive", async () => {
  expect(
    () =>
      new GooglePaLM({
        topP: -1,
      })
  ).toThrow();
});

test("Google Palm - `topP` must be in the range [0,1]", async () => {
  expect(
    () =>
      new GooglePaLM({
        topP: 3,
      })
  ).toThrow();
});

test("Google Palm - `topK` must be positive", async () => {
  expect(
    () =>
      new GooglePaLM({
        topK: -1,
      })
  ).toThrow();
});

test("Google Palm - `safetySettings` category array must be unique", async () => {
  expect(
    () =>
      new GooglePaLM({
        safetySettings: [
          {
            category: "HARM_CATEGORY_DANGEROUS",
            threshold: 1,
          },
          {
            category: "HARM_CATEGORY_DANGEROUS",
            threshold: 2,
          },
          {
            category: "HARM_CATEGORY_DEROGATORY",
            threshold: 1,
          },
        ],
      })
  ).toThrow();
});
