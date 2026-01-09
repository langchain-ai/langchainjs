import { test, expect, describe } from "vitest";

import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";

import { ChatXAIResponses } from "../index.js";

test("invoke", async () => {
  const chat = new ChatXAIResponses({
    model: "grok-3-fast",
    maxRetries: 0,
  });
  const message = new HumanMessage("What color is the sky?");
  const res = await chat.invoke([message]);
  // console.log({ res });
  expect(res.content.length).toBeGreaterThan(10);
});

test("invoke with stop sequence", async () => {
  const chat = new ChatXAIResponses({
    model: "grok-3-fast",
    maxRetries: 0,
  });
  const message = new HumanMessage("Count to ten.");
  const res = await chat.withConfig({ stop: ["5", "five"] }).invoke([message]);
  // console.log({ res });
  expect((res.content as string).toLowerCase()).not.toContain("6");
  expect((res.content as string).toLowerCase()).not.toContain("six");
});

test("invoke with temperature", async () => {
  const chat = new ChatXAIResponses({
    model: "grok-3-fast",
    maxRetries: 0,
    temperature: 0.1,
  });
  const message = new HumanMessage("What is 2 + 2?");
  const res = await chat.invoke([message]);
  expect(res.content).toBeDefined();
  expect((res.content as string).length).toBeGreaterThan(0);
});

test("generate", async () => {
  const chat = new ChatXAIResponses({
    model: "grok-3-fast",
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generate([[message]]);
  // console.log(JSON.stringify(res, null, 2));
  expect(res.generations[0][0].text.length).toBeGreaterThan(5);
});

test("streaming", async () => {
  const chat = new ChatXAIResponses({
    model: "grok-3-fast",
  });
  const message = new HumanMessage("What color is the sky?");
  const stream = await chat.stream([message]);
  let iters = 0;
  let finalRes = "";
  for await (const chunk of stream) {
    iters += 1;
    finalRes += chunk.content;
  }
  // console.log({ finalRes, iters });
  expect(iters).toBeGreaterThan(1);
  expect(finalRes.length).toBeGreaterThan(10);
});

test("streaming with streaming option in constructor", async () => {
  const chat = new ChatXAIResponses({
    model: "grok-3-fast",
    streaming: true,
  });
  const message = new HumanMessage("Count from 1 to 5.");
  const stream = await chat.stream([message]);
  let finalChunk: AIMessageChunk | undefined;
  for await (const chunk of stream) {
    finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
  }
  expect(finalChunk).toBeDefined();
  expect(finalChunk?.content).toBeDefined();
});

test("invoke with response metadata", async () => {
  const chat = new ChatXAIResponses({
    model: "grok-3-fast",
    maxRetries: 0,
  });
  const message = new HumanMessage("Hello");
  const res = await chat.invoke([message]);

  // Check that usage metadata is present
  expect(res.usage_metadata).toBeDefined();
  if (res.usage_metadata) {
    expect(res.usage_metadata.input_tokens).toBeGreaterThan(0);
    expect(res.usage_metadata.output_tokens).toBeGreaterThan(0);
    expect(res.usage_metadata.total_tokens).toBeGreaterThan(0);
  }
});

test("invoke with system message", async () => {
  const chat = new ChatXAIResponses({
    model: "grok-3-fast",
    maxRetries: 0,
  });
  const messages = [
    {
      role: "system",
      content: "You are a helpful assistant that speaks like a pirate.",
    },
    new HumanMessage("Say hello"),
  ];
  // @ts-expect-error - testing with mixed message types
  const res = await chat.invoke(messages);
  expect(res.content).toBeDefined();
});

// Search/Reasoning Tests
describe("Search and Reasoning", () => {
  test("invoke with searchParameters in constructor", async () => {
    const chat = new ChatXAIResponses({
      model: "grok-3-fast",
      maxRetries: 0,
      searchParameters: {
        mode: "auto",
        max_search_results: 5,
      },
    });

    const message = new HumanMessage("What happened in the news today?");
    const res = await chat.invoke([message]);

    expect(res.content).toBeDefined();
    expect((res.content as string).length).toBeGreaterThan(50);
  });

  test("invoke with searchParameters in call options", async () => {
    const chat = new ChatXAIResponses({
      model: "grok-3-fast",
      maxRetries: 0,
    });

    const message = new HumanMessage(
      "What is the current status of SpaceX launches?"
    );
    const res = await chat.invoke([message], {
      search_parameters: {
        mode: "on",
        max_search_results: 3,
      },
    });

    expect(res.content).toBeDefined();
    expect((res.content as string).length).toBeGreaterThan(50);
  });

  test("invoke with reasoning enabled", async () => {
    const chat = new ChatXAIResponses({
      model: "grok-3-mini-fast",
      maxRetries: 0,
      reasoning: {
        effort: "low",
      },
    });

    const message = new HumanMessage("What is 15 * 27?");
    const res = await chat.invoke([message]);

    expect(res.content).toBeDefined();
    // The response should contain the answer
    expect(res.content as string).toContain("405");
  });

  test("invoke with reasoning in call options", async () => {
    const chat = new ChatXAIResponses({
      model: "grok-3-mini-fast",
      maxRetries: 0,
    });

    const message = new HumanMessage(
      "If I have 3 apples and give away 1, how many do I have?"
    );
    const res = await chat.invoke([message], {
      reasoning: {
        effort: "low",
      },
    });

    expect(res.content).toBeDefined();
    expect(res.content as string).toContain("2");
  });

  test("stream with searchParameters", async () => {
    const chat = new ChatXAIResponses({
      model: "grok-3-fast",
      maxRetries: 0,
      searchParameters: {
        mode: "auto",
      },
    });

    const message = new HumanMessage("What are the top tech news stories?");
    const stream = await chat.stream([message]);

    let finalMessage: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      finalMessage = !finalMessage ? chunk : concat(finalMessage, chunk);
    }

    expect(finalMessage).toBeDefined();
    expect(finalMessage?.content).toBeDefined();
  });
});

// Multi-turn conversation tests
describe("Multi-turn Conversations", () => {
  test("should handle multi-turn conversation", async () => {
    const chat = new ChatXAIResponses({
      model: "grok-3-fast",
      maxRetries: 0,
    });

    const messages = [new HumanMessage("My name is Alice.")];
    const res1 = await chat.invoke(messages);
    expect(res1.content).toBeDefined();

    // Continue conversation
    messages.push(res1);
    messages.push(new HumanMessage("What is my name?"));
    const res2 = await chat.invoke(messages);

    expect(res2.content).toBeDefined();
    expect((res2.content as string).toLowerCase()).toContain("alice");
  });
});

// Error handling tests
describe("Error Handling", () => {
  test("should throw error for invalid API key", async () => {
    const chat = new ChatXAIResponses({
      model: "grok-3-fast",
      maxRetries: 0,
      apiKey: "invalid-key",
    });

    const message = new HumanMessage("Hello");
    await expect(chat.invoke([message])).rejects.toThrow();
  });
});

// Reasoning contentBlocks tests
describe("xAI Reasoning with contentBlocks", () => {
  test("invoke returns reasoning in contentBlocks", async () => {
    const chat = new ChatXAIResponses({
      model: "grok-3-mini-fast",
      maxRetries: 0,
      reasoning: {
        effort: "low",
        summary: "auto",
      },
    });

    const result = await chat.invoke("What is 2 + 2?");

    // Verify contentBlocks contains reasoning
    const blocks = result.contentBlocks;
    expect(blocks.length).toBeGreaterThan(0);

    const reasoningBlocks = blocks.filter((b) => b.type === "reasoning");
    expect(reasoningBlocks.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((reasoningBlocks[0] as any).reasoning.length).toBeGreaterThan(0);

    const textBlocks = blocks.filter((b) => b.type === "text");
    expect(textBlocks.length).toBeGreaterThan(0);
  });

  test("stream returns reasoning in contentBlocks", async () => {
    const chat = new ChatXAIResponses({
      model: "grok-3-mini-fast",
      maxRetries: 0,
      reasoning: {
        effort: "low",
        summary: "auto",
      },
    });

    let fullMessage: AIMessageChunk | undefined;
    for await (const chunk of await chat.stream("What is 3 + 3?")) {
      fullMessage = !fullMessage ? chunk : concat(fullMessage, chunk);
    }

    expect(fullMessage).toBeDefined();
    const blocks = fullMessage!.contentBlocks;
    expect(blocks.length).toBeGreaterThan(0);

    const reasoningBlocks = blocks.filter((b) => b.type === "reasoning");
    expect(reasoningBlocks.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((reasoningBlocks[0] as any).reasoning.length).toBeGreaterThan(0);
  }, 60000);
});
