/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, describe } from "vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { ChatDeepSeek } from "../chat_models.js";

describe("DeepSeek Reasoning", () => {
  test("invoke returns reasoning in additional_kwargs", async () => {
    const llm = new ChatDeepSeek({
      model: "deepseek-reasoner",
    });
    const input = `Translate "I love programming" into French.`;
    const result = await llm.invoke(input);
    expect(
      (result.additional_kwargs.reasoning_content as any).length
    ).toBeGreaterThan(10);
  });

  test("invoke returns reasoning in contentBlocks", async () => {
    const llm = new ChatDeepSeek({
      model: "deepseek-reasoner",
    });
    const result = await llm.invoke("What is 2 + 2?");

    // Verify contentBlocks contains reasoning
    const blocks = result.contentBlocks;
    expect(blocks.length).toBeGreaterThan(0);

    const reasoningBlocks = blocks.filter((b) => b.type === "reasoning");
    expect(reasoningBlocks.length).toBeGreaterThan(0);
    expect((reasoningBlocks[0] as any).reasoning.length).toBeGreaterThan(10);

    const textBlocks = blocks.filter((b) => b.type === "text");
    expect(textBlocks.length).toBeGreaterThan(0);
  });

  test("stream returns reasoning in contentBlocks", async () => {
    const llm = new ChatDeepSeek({
      model: "deepseek-reasoner",
    });

    let fullMessage: AIMessageChunk | null = null;
    for await (const chunk of await llm.stream("What is 3 + 3?")) {
      fullMessage = fullMessage ? concat(fullMessage, chunk) : chunk;
    }

    expect(fullMessage).toBeDefined();
    const blocks = fullMessage!.contentBlocks;
    expect(blocks.length).toBeGreaterThan(0);

    const reasoningBlocks = blocks.filter((b) => b.type === "reasoning");
    expect(reasoningBlocks.length).toBeGreaterThan(0);
    expect((reasoningBlocks[0] as any).reasoning.length).toBeGreaterThan(10);
  }, 60000);
});
