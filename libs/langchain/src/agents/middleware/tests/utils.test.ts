import { z } from "zod/v3";
import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

import { countTokensApproximately } from "../utils.js";

describe("countTokensApproximately", () => {
  describe("script density (issue #11304)", () => {
    it("should not underrate CJK / Hangul relative to Latin prose of similar meaning", () => {
      // Parallel sentences of roughly the same content length intent;
      // under a fixed 4-chars/token budget the non-Latin samples are
      // severely under-counted.
      const english =
        "LangChain is a framework for developing applications powered by language models.";
      const korean =
        "랭체인은 언어 모델을 기반으로 애플리케이션을 개발하기 위한 프레임워크입니다.";
      const japanese =
        "ラングチェーンは、言語モデルを利用したアプリケーションを開発するためのフレームワークです。";
      const chinese =
        "朗琴是一个用于开发由语言模型驱动的应用程序的框架。它使应用程序能够感知上下文。";

      const en = countTokensApproximately([new HumanMessage(english)]);
      const ko = countTokensApproximately([new HumanMessage(korean)]);
      const ja = countTokensApproximately([new HumanMessage(japanese)]);
      const zh = countTokensApproximately([new HumanMessage(chinese)]);

      // Dense-script estimates must not be drastically smaller than the
      // Latin baseline (old fixed-4 ratio reported ~60% undercounts).
      expect(ko).toBeGreaterThan(en * 0.7);
      expect(ja).toBeGreaterThan(en * 0.7);
      expect(zh).toBeGreaterThan(en * 0.7);
    });

    it("should still scale roughly with pure Latin length at ~4 chars/token", () => {
      const short = countTokensApproximately([new HumanMessage("abcd")]);
      const long = countTokensApproximately([
        new HumanMessage("abcd".repeat(25)),
      ]);
      // 4 chars → 1 token; 100 chars → 25 tokens
      expect(short).toBe(1);
      expect(long).toBe(25);
    });

    it("should count CJK ideographs denser than Latin letters of the same length", () => {
      const latin = countTokensApproximately([new HumanMessage("aaaa")]);
      const cjk = countTokensApproximately([new HumanMessage("你好世界")]);
      expect(latin).toBe(1);
      // 4 CJK chars at 1.5 chars/token ≈ 2.67 → ceil 3
      expect(cjk).toBeGreaterThan(latin);
      expect(cjk).toBe(3);
    });
  });

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
});
