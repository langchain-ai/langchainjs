import { test } from "@jest/globals";
import type { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatGoogleGenerativeAI } from "../chat_models.js";
import { removeAdditionalProperties } from "../utils/zod_to_genai_parameters.js";

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

test("removeAdditionalProperties can remove all instances of additionalProperties", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractKeys(obj: Record<string, any>, keys: string[] = []) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        keys.push(key);
        if (typeof obj[key] === "object" && obj[key] !== null) {
          extractKeys(obj[key], keys);
        }
      }
    }
    return keys;
  }

  const idealResponseSchema = z.object({
    idealResponse: z
      .string()
      .optional()
      .describe("The ideal response to the question"),
  });
  const questionSchema = z.object({
    question: z.string().describe("Question text"),
    type: z.enum(["singleChoice", "multiChoice"]).describe("Question type"),
    options: z.array(z.string()).describe("List of possible answers"),
    correctAnswer: z
      .string()
      .optional()
      .describe("correct answer from the possible answers"),
    idealResponses: z
      .array(idealResponseSchema)
      .describe("Array of ideal responses to the question"),
  });

  const schema = z.object({
    questions: z.array(questionSchema).describe("Array of question objects"),
  });

  const parsedSchemaArr = removeAdditionalProperties(zodToJsonSchema(schema));
  const arrSchemaKeys = extractKeys(parsedSchemaArr);
  expect(
    arrSchemaKeys.find((key) => key === "additionalProperties")
  ).toBeUndefined();
  const parsedSchemaObj = removeAdditionalProperties(
    zodToJsonSchema(questionSchema)
  );
  const arrSchemaObj = extractKeys(parsedSchemaObj);
  expect(
    arrSchemaObj.find((key) => key === "additionalProperties")
  ).toBeUndefined();
});
