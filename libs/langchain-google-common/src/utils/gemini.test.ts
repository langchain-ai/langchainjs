import { test, expect } from "@jest/globals";
import { HumanMessage } from "@langchain/core/messages";
import { getGeminiAPI } from "./gemini.js";
import type { GoogleAIModelRequestParams, GeminiRequest } from "../types.js";

describe("getGeminiAPI", () => {
  describe("formatData", () => {
    test("should include labels from parameters in the GeminiRequest", async () => {
      const geminiAPI = getGeminiAPI();
      const input = [new HumanMessage("Hello")];
      const labels = {
        "test-label-1": "value1",
        "another-label": "value2",
      };
      const parameters: GoogleAIModelRequestParams = {
        model: "gemini-pro",
        labels,
      };

      const result = (await geminiAPI.formatData(
        input,
        parameters
      )) as GeminiRequest;

      expect(result.labels).toBeDefined();
      expect(result.labels).toEqual(labels);
      expect(result.contents).toBeDefined();
      expect(result.generationConfig).toBeDefined();
    });

    test("should not include labels if not provided in parameters", async () => {
      const geminiAPI = getGeminiAPI();
      const input = [new HumanMessage("Hello again")];
      const parameters: GoogleAIModelRequestParams = {
        model: "gemini-pro",
        // No labels here
      };

      const result = (await geminiAPI.formatData(
        input,
        parameters
      )) as GeminiRequest;

      expect(result.labels).toBeUndefined();
      expect(result.contents).toBeDefined();
      expect(result.generationConfig).toBeDefined();
    });

    test("should handle empty labels object", async () => {
      const geminiAPI = getGeminiAPI();
      const input = [new HumanMessage("Hello with empty labels")];
      const labels = {};
      const parameters: GoogleAIModelRequestParams = {
        model: "gemini-pro",
        labels,
      };

      const result = (await geminiAPI.formatData(
        input,
        parameters
      )) as GeminiRequest;

      expect(result.labels).toBeDefined();
      expect(result.labels).toEqual({});
      expect(result.contents).toBeDefined();
      expect(result.generationConfig).toBeDefined();
    });
  });
});
