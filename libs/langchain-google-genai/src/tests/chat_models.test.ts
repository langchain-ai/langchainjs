import { test } from "@jest/globals";
import type { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

test("Google AI - `temperature` must be in range [0.0,1.0]", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        temperature: -1.0,
      })
  ).toThrow();
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        temperature: 1.1,
      })
  ).toThrow();
});

test("Google AI - `maxOutputTokens` must be positive", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        maxOutputTokens: -1,
      })
  ).toThrow();
});

test("Google AI - `topP` must be positive", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        topP: -1,
      })
  ).toThrow();
});

test("Google AI - `topP` must be in the range [0,1]", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        topP: 3,
      })
  ).toThrow();
});

test("Google AI - `topK` must be positive", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        topK: -1,
      })
  ).toThrow();
});

test("Google AI - `safetySettings` category array must be unique", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
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
