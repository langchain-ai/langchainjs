import { expect, it, describe } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";

import { ChatAnthropic } from "../../chat_models.js";
import { webFetch_20250910 } from "../webFetch.js";

const createModel = () =>
  new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
  });

describe("Anthropic Web Fetch Tool Integration Tests", () => {
  it("web fetch tool can be bound to ChatAnthropic and triggers server tool use", async () => {
    const llm = createModel();
    const llmWithWebFetch = llm.bindTools([
      webFetch_20250910({ maxUses: 1, citations: { enabled: true } }),
    ]);

    const response = await llmWithWebFetch.invoke([
      new HumanMessage(
        "Please fetch and summarize the content at https://example.com"
      ),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    expect(Array.isArray(response.content)).toBe(true);

    const contentBlocks = response.content as Array<{ type: string }>;
    const hasServerToolUse = contentBlocks.some(
      (block) => block.type === "server_tool_use"
    );
    const hasWebFetchResult = contentBlocks.some(
      (block) => block.type === "web_fetch_tool_result"
    );

    expect(hasServerToolUse).toBe(true);
    expect(hasWebFetchResult).toBe(true);
    expect(
      (response.content as Array<{ text: string }>).find(
        (block) =>
          block.text ===
          "This domain is for use in documentation examples without needing permission."
      )
    );
  }, 30000);

  it("web fetch tool streaming works correctly", async () => {
    const llm = createModel();
    const llmWithWebFetch = llm.bindTools([
      webFetch_20250910({ maxUses: 1, citations: { enabled: true } }),
    ]);

    const stream = await llmWithWebFetch.stream([
      new HumanMessage(
        "Please fetch and describe the content at https://example.com"
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

    expect(hasServerToolUse).toBe(true);
    expect(
      (finalChunk?.content as Array<{ text: string }>).find(
        (block) =>
          block.text ===
          "This domain is for use in documentation examples without needing permission."
      )
    );
  }, 30000);
});
