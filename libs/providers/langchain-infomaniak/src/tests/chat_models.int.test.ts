import { describe, test, expect } from "vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { ChatInfomaniak } from "../chat_models.js";

describe("ChatInfomaniak integration", () => {
  test("invoke returns a response", async () => {
    const chat = new ChatInfomaniak({
      model: "qwen3",
      temperature: 0,
    });
    const result = await chat.invoke(
      "What is 2 + 2? Answer with just the number."
    );
    expect(typeof result.content).toBe("string");
    expect((result.content as string).length).toBeGreaterThan(0);
  });

  test("invoke with system message", async () => {
    const chat = new ChatInfomaniak({
      model: "qwen3",
      temperature: 0,
    });
    const result = await chat.invoke([
      ["system", "You are a helpful assistant. Reply concisely."],
      ["human", "What is the capital of Switzerland?"],
    ]);
    expect(typeof result.content).toBe("string");
    expect((result.content as string).toLowerCase()).toContain("bern");
  });

  test("stream returns chunks", async () => {
    const chat = new ChatInfomaniak({
      model: "qwen3",
      temperature: 0,
    });

    let fullMessage: AIMessageChunk | null = null;
    for await (const chunk of await chat.stream("Say hello in French.")) {
      expect(chunk).toBeInstanceOf(AIMessageChunk);
      fullMessage = fullMessage ? concat(fullMessage, chunk) : chunk;
    }

    expect(fullMessage).toBeDefined();
    expect(typeof fullMessage!.content).toBe("string");
    expect((fullMessage!.content as string).length).toBeGreaterThan(0);
  }, 30000);

  test("invoke with tool calling", async () => {
    const chat = new ChatInfomaniak({
      model: "qwen3",
      temperature: 0,
    });

    const llmWithTools = chat.bindTools([
      {
        name: "get_weather",
        description: "Get the current weather in a given location",
        schema: {
          type: "object" as const,
          properties: {
            location: {
              type: "string",
              description: "The city name",
            },
          },
          required: ["location"],
        },
      },
    ]);

    const result = await llmWithTools.invoke("What is the weather in Geneva?");
    expect(result.tool_calls).toBeDefined();
    expect(result.tool_calls!.length).toBeGreaterThan(0);
    expect(result.tool_calls![0].name).toBe("get_weather");
  });

  test("generate with multiple prompts", async () => {
    const chat = new ChatInfomaniak({
      model: "qwen3",
      temperature: 0,
      maxTokens: 50,
    });
    const result = await chat.generate([
      [["human", "Say hi"]],
      [["human", "Say bye"]],
    ]);
    expect(result.generations.length).toBe(2);
    expect(result.generations[0][0].text.length).toBeGreaterThan(0);
    expect(result.generations[1][0].text.length).toBeGreaterThan(0);
  });
});
