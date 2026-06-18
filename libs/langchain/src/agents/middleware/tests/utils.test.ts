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
});
