import { expect, it, describe } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { ChatAnthropic, type AnthropicInput } from "../../chat_models.js";
import {
  toolSearchRegex_20251119,
  toolSearchBM25_20251119,
} from "../toolSearch.js";

const createModel = (args: AnthropicInput = {}) =>
  new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
    ...args,
  });

const getWeatherTool = tool(() => "72°F and sunny", {
  name: "get_weather",
  description: "Get the weather at a specific location",
  extras: { defer_loading: true },
  schema: z.object({
    location: z.string().describe("The location to get weather for"),
    unit: z
      .enum(["celsius", "fahrenheit"])
      .optional()
      .describe("Temperature unit"),
  }),
});

const searchFilesWithoutDeferLoading = tool(
  () => "Found 3 files matching query",
  {
    name: "search_files",
    description: "Search through files in the workspace",
    schema: z.object({
      query: z.string().describe("The search query"),
      file_types: z
        .array(z.string())
        .optional()
        .describe("File types to search"),
    }),
  }
);

const searchFilesTool = tool(() => "Found 3 files matching query", {
  name: "search_files",
  description: "Search through files in the workspace",
  extras: { defer_loading: true },
  schema: z.object({
    query: z.string().describe("The search query"),
    file_types: z.array(z.string()).optional().describe("File types to search"),
  }),
});

describe("Anthropic Tool Search Tool Integration Tests", () => {
  it("should not find the tool if tool search tool is not present", async () => {
    const llm = createModel({
      clientOptions: {
        defaultHeaders: {
          "anthropic-beta": "advanced-tool-use-2025-11-20",
        },
      },
    });
    const llmWithToolSearch = llm.bindTools([
      getWeatherTool,
      searchFilesWithoutDeferLoading,
    ]);

    const response = await llmWithToolSearch.invoke([
      new HumanMessage("What is the weather in San Francisco?"),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    expect(response.content).toContain("I don't have access to a weather tool");
  });

  describe("Regex variant", () => {
    it("tool search regex can discover deferred tools", async () => {
      const llm = createModel();
      const llmWithToolSearch = llm.bindTools([
        toolSearchRegex_20251119(),
        getWeatherTool,
        searchFilesTool,
      ]);

      const response = await llmWithToolSearch.invoke([
        new HumanMessage("What is the weather in San Francisco?"),
      ]);

      expect(response).toBeInstanceOf(AIMessage);
      expect(Array.isArray(response.content)).toBe(true);

      const contentBlocks = response.content as Array<{ type: string }>;
      const hasServerToolUse = contentBlocks.some(
        (block) => block.type === "server_tool_use"
      );
      const hasToolResult = contentBlocks.some(
        (block) => block.type === "tool_use"
      );

      expect(hasServerToolUse).toBe(true);
      expect(hasToolResult).toBe(true);
      expect(response.tool_calls).toHaveLength(1);
      expect(response.tool_calls?.[0]).toEqual(
        expect.objectContaining({
          name: "get_weather",
          type: "tool_call",
          args: {
            location: "San Francisco",
          },
        })
      );
    }, 60000);

    it("tool search regex streaming works correctly", async () => {
      const llm = createModel();
      const llmWithToolSearch = llm.bindTools([
        toolSearchRegex_20251119(),
        getWeatherTool,
      ]);

      const stream = await llmWithToolSearch.stream([
        new HumanMessage("What is the weather in New York?"),
      ]);

      let finalChunk: AIMessageChunk | undefined;
      for await (const chunk of stream) {
        if (!finalChunk) {
          finalChunk = chunk;
        } else {
          finalChunk = concat(finalChunk, chunk);
        }
      }

      expect(finalChunk).toBeDefined();
      expect(finalChunk).toBeInstanceOf(AIMessageChunk);
      const contentBlocks = finalChunk?.content as Array<{ type: string }>;
      const hasServerToolUse = contentBlocks.some(
        (block) => block.type === "server_tool_use"
      );
      const hasToolResult = contentBlocks.some(
        (block) => block.type === "tool_use"
      );

      expect(hasServerToolUse).toBe(true);
      expect(hasToolResult).toBe(true);
      expect(finalChunk?.tool_calls).toHaveLength(1);
      expect(finalChunk?.tool_calls?.[0]).toEqual(
        expect.objectContaining({
          name: "get_weather",
          type: "tool_call",
          args: {
            location: "New York",
          },
        })
      );
    }, 60000);
  });

  describe("BM25 variant", () => {
    it("tool search BM25 can discover deferred tools", async () => {
      const llm = createModel();
      const llmWithToolSearch = llm.bindTools([
        toolSearchBM25_20251119(),
        getWeatherTool,
        searchFilesTool,
      ]);

      const response = await llmWithToolSearch.invoke([
        new HumanMessage("What is the weather in Seattle?"),
      ]);

      expect(response).toBeInstanceOf(AIMessage);
      expect(Array.isArray(response.content)).toBe(true);

      const contentBlocks = response.content as Array<{ type: string }>;
      const hasServerToolUse = contentBlocks.some(
        (block) => block.type === "server_tool_use"
      );
      const hasToolResult = contentBlocks.some(
        (block) => block.type === "tool_use"
      );

      expect(hasServerToolUse).toBe(true);
      expect(hasToolResult).toBe(true);
      expect(response.tool_calls).toHaveLength(1);
      expect(response.tool_calls?.[0]).toEqual(
        expect.objectContaining({
          name: "get_weather",
          type: "tool_call",
          args: {
            location: "Seattle",
          },
        })
      );
    }, 60000);
  });
});
