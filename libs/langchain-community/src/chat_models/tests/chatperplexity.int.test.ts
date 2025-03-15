import { describe, test, expect } from "@jest/globals";
import { ChatPerplexity } from "../perplexity.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

describe("ChatPerplexity", () => {
  test("should call ChatPerplexity", async () => {
    const chat = new ChatPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
    });
    const message = new HumanMessage("What is the capital of India?");
    const response = await chat._generate([message]);
    expect(response.generations[0].text.length).toBeGreaterThan(10);
  });

  test("should handle streaming", async () => {
    const chat = new ChatPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
      streaming: true,
    });
    const message = new HumanMessage("What is the capital of India?");
    const stream = await chat._streamResponseChunks([message], {});
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.text).join("")).toContain("New Delhi");
  });

  test("should handle system messages", async () => {
    const chat = new ChatPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
    });
    const messages = [
      new SystemMessage("You are a geography expert."),
      new HumanMessage("What is the capital of India?"),
    ];
    const response = await chat._generate(messages);
    expect(response.generations[0].text.length).toBeGreaterThan(10);
  });
});
