import { test } from "@jest/globals";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "../llms.js";

test("Google AI - `modelName` must starts with `models/gemini`", async () => {
  expect(
    () =>
      new GoogleGenerativeAI({
        modelName: "models/text-bison-001",
      })
  ).toThrow();
});

test("Google AI - `temperature` must be in range [0.0,1.0]", async () => {
  expect(
    () =>
      new GoogleGenerativeAI({
        temperature: -1.0,
      })
  ).toThrow();
  expect(
    () =>
      new GoogleGenerativeAI({
        temperature: 1.1,
      })
  ).toThrow();
});

test("Google AI - `maxOutputTokens` must be positive", async () => {
  expect(
    () =>
      new GoogleGenerativeAI({
        maxOutputTokens: -1,
      })
  ).toThrow();
});

test("Google AI - `topP` must be positive", async () => {
  expect(
    () =>
      new GoogleGenerativeAI({
        topP: -1,
      })
  ).toThrow();
});

test("Google AI - `topP` must be in the range [0,1]", async () => {
  expect(
    () =>
      new GoogleGenerativeAI({
        topP: 3,
      })
  ).toThrow();
});

test("Google AI - `topK` must be positive", async () => {
  expect(
    () =>
      new GoogleGenerativeAI({
        topK: -1,
      })
  ).toThrow();
});

test("Google AI - `safetySettings` category array must be valid", async () => {
  expect(
    () =>
      new GoogleGenerativeAI({
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT" as HarmCategory,
            threshold: "BLOCK_MEDIUM_AND_ABOVE" as HarmBlockThreshold,
          },
          {
            category: "HARM_CATEGORY_HARASSMENT" as HarmCategory,
            threshold: "BLOCK_LOW_AND_ABOVE" as HarmBlockThreshold,
          },
          {
            category: "HARM_CATEGORY_DEROGATORY" as HarmCategory,
            threshold: "BLOCK_ONLY_HIGH" as HarmBlockThreshold,
          },
        ],
      })
  ).toThrow();
});

test("Google AI - `safetySettings` category array must be unique", async () => {
  expect(
    () =>
      new GoogleGenerativeAI({
        safetySettings: [
          {
            category: "WRONG_HARM_CATEGORY" as HarmCategory,
            threshold: "BLOCK_MEDIUM_AND_ABOVE" as HarmBlockThreshold,
          },
        ],
      })
  ).toThrow();
});
