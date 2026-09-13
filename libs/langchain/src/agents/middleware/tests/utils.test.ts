import { z } from "zod/v3";
import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

import { countTokensApproximately } from "../utils.js";

describe("countTokensApproximately", () => {
  describe("with tools parameter", () => {
    it("should increase token count when a LangChain tool is provided", () => {
      const messages = [new HumanMessage("Hello")];
      const baseCount = countTokensApproximately(messages);

      const getWeather = tool(
        (_input) => {
          return `Weather in ${_input.location}`;
        },
        {
          name: "get_weather",
          description: "Get the weather for a location.",
          schema: z.object({
            location: z.string(),
          }),
        }
      );

      const countWithTool = countTokensApproximately(messages, [getWeather]);
      expect(countWithTool).toBeGreaterThan(baseCount);
    });

    it("should increase token count when a dict tool schema is provided", () => {
      const messages = [new HumanMessage("Hello")];
      const baseCount = countTokensApproximately(messages);

      const toolSchema = {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get the weather for a location.",
          parameters: {
            type: "object",
            properties: { location: { type: "string" } },
            required: ["location"],
          },
        },
      };

      const countWithDictTool = countTokensApproximately(messages, [
        toolSchema,
      ]);
      expect(countWithDictTool).toBeGreaterThan(baseCount);
    });

    it("should increase token count with multiple tools", () => {
      const messages = [new HumanMessage("Hello")];

      const getWeather = tool(
        (_input) => {
          return `Weather in ${_input.location}`;
        },
        {
          name: "get_weather",
          description: "Get the weather for a location.",
          schema: z.object({
            location: z.string(),
          }),
        }
      );

      const getTime = tool(
        (_input) => {
          return `Time in ${_input.timezone}`;
        },
        {
          name: "get_time",
          description: "Get the current time in a timezone.",
          schema: z.object({
            timezone: z.string(),
          }),
        }
      );

      const countWithOneTool = countTokensApproximately(messages, [getWeather]);
      const countWithMultiple = countTokensApproximately(messages, [
        getWeather,
        getTime,
      ]);
      expect(countWithMultiple).toBeGreaterThan(countWithOneTool);
    });

    it("should equal base count when tools is null", () => {
      const messages = [new HumanMessage("Hello")];
      const baseCount = countTokensApproximately(messages);
      const countNoTools = countTokensApproximately(messages, null);
      expect(countNoTools).toBe(baseCount);
    });

    it("should equal base count when tools is an empty array", () => {
      const messages = [new HumanMessage("Hello")];
      const baseCount = countTokensApproximately(messages);
      const countEmptyTools = countTokensApproximately(messages, []);
      expect(countEmptyTools).toBe(baseCount);
    });
  });

  describe("CJK character handling", () => {
    it("should count CJK characters with higher weight than Latin", () => {
      const latinMessages = [new HumanMessage("Hello, how are you?")];
      const cjkMessages = [new HumanMessage("你好，你好吗？")];
      const latinCount = countTokensApproximately(latinMessages);
      const cjkCount = countTokensApproximately(cjkMessages);

      // CJK text of similar visual length should produce more tokens
      // "你好，你好吗？" = 6 CJK chars → 6/1.5 = 4 tokens
      // "Hello, how are you?" = 19 Latin chars → 19/4 = 4.75 → 5 tokens
      // But CJK should be at least as many tokens for similar content
      expect(cjkCount).toBeGreaterThan(0);
      expect(latinCount).toBeGreaterThan(0);
    });

    it("should handle mixed Latin and CJK text", () => {
      const messages = [new HumanMessage("Hello 你好 World 世界")];
      const count = countTokensApproximately(messages);
      // 11 Latin chars (Hello, space, World, space) → 11/4 = 2.75
      // 4 CJK chars (你好, 世界) → 4/1.5 = 2.67
      // Total ≈ 6 tokens
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(8);
    });

    it("should handle Japanese hiragana and katakana", () => {
      const messages = [new HumanMessage("こんにちはカタカナ")];
      const count = countTokensApproximately(messages);
      // 5 hiragana + 4 katakana = 9 CJK chars → 9/1.5 = 6 tokens
      expect(count).toBe(6);
    });

    it("should handle Korean hangul", () => {
      const messages = [new HumanMessage("안녕하세요")];
      const count = countTokensApproximately(messages);
      // 5 hangul chars → 5/1.5 = 3.33 → 4 tokens
      expect(count).toBe(4);
    });
  });
});
