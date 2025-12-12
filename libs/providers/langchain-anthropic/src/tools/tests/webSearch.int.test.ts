import { expect, it, describe } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";

import { ChatAnthropic } from "../../chat_models.js";
import { webSearch_20250305 } from "../webSearch.js";

const createModel = () =>
  new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
  });

describe("Anthropic Web Search Tool Integration Tests", () => {
  it("web search tool can be bound to ChatAnthropic and triggers server tool use", async () => {
    const llm = createModel();
    const llmWithWebSearch = llm.bindTools([
      webSearch_20250305({ maxUses: 1 }),
    ]);

    const response = await llmWithWebSearch.invoke([
      new HumanMessage("What is the current weather in San Francisco?"),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    expect(Array.isArray(response.content)).toBe(true);

    const contentBlocks = response.content as Array<{ type: string }>;
    const hasServerToolUse = contentBlocks.some(
      (block) => block.type === "server_tool_use"
    );
    const hasWebSearchResult = contentBlocks.some(
      (block) => block.type === "web_search_tool_result"
    );

    expect(hasServerToolUse).toBe(true);
    expect(hasWebSearchResult).toBe(true);
  }, 30000);

  it("web search tool streaming works correctly", async () => {
    const llm = createModel();
    const llmWithWebSearch = llm.bindTools([
      webSearch_20250305({ maxUses: 1 }),
    ]);

    const stream = await llmWithWebSearch.stream([
      new HumanMessage(
        "What is the capital of France according to a web search?"
      ),
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
    expect(Array.isArray(finalChunk?.content)).toBe(true);
    const contentBlocks = finalChunk?.content as Array<{ type: string }>;
    const hasServerToolUse = contentBlocks.some(
      (block) => block.type === "server_tool_use"
    );
    const hasWebSearchResult = contentBlocks.some(
      (block) => block.type === "web_search_tool_result"
    );

    expect(hasServerToolUse).toBe(true);
    expect(hasWebSearchResult).toBe(true);
  }, 30000);
});
