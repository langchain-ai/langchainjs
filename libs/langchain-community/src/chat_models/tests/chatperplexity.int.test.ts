/* eslint-disable no-process-env */
import { describe, test, expect } from "@jest/globals";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

import { ChatPerplexity } from "../perplexity.js";

describe("ChatPerplexity", () => {
  test("should call ChatPerplexity", async () => {
    const chat = new ChatPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
      model: "sonar",
    });
    const message = new HumanMessage("What is the capital of India?");
    const response = await chat.invoke([message], {});
    expect(response.content.length).toBeGreaterThan(10);
  });

  test("aggregated response using streaming", async () => {
    const chat = new ChatPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
      model: "sonar",
      streaming: true,
    });
    const message = new HumanMessage("What is the capital of India?");
    const response = await chat.invoke([message], {});
    expect(response.content.length).toBeGreaterThan(10);
  });

  test("use invoke", async () => {
    const chat = new ChatPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
      model: "sonar",
    });
    const response = await chat.invoke("What is the capital of India?");
    expect(response.content.length).toBeGreaterThan(10);
  });

  test("should handle streaming", async () => {
    const chat = new ChatPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
      streaming: true,
      model: "sonar",
    });
    const message = new HumanMessage("What is the capital of India?");
    const stream = await chat.stream([message], {});
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.content).join("")).toContain("New Delhi");
  });

  test("should handle system messages", async () => {
    const chat = new ChatPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
      model: "sonar",
    });
    const messages = [
      new SystemMessage("You are a geography expert."),
      new HumanMessage("What is the capital of India?"),
    ];
    const response = await chat.invoke(messages);
    expect(response.content.length).toBeGreaterThan(10);
  });

  // Requires usage tier 3
  test("structured output", async () => {
    const chat = new ChatPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
      model: "sonar",
    }).withStructuredOutput(
      z.object({
        capital: z.string(),
        country: z.string(),
      })
    );
    const messages = [
      new SystemMessage("You are a geography expert."),
      new HumanMessage("What is the capital of India? Return JSON."),
    ];
    const response = await chat.invoke(messages);
    expect(response.capital).toBe("New Delhi");
    expect(response.country).toBe("India");
  });

  test("ChatPerplexity reasoning model with structured output", async () => {
    const responseSchema = z.object({
      answer: z.string().describe("Answer to the question"),
      reasoning: z.string().describe("Reasoning process for the answer"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("Confidence level of the answer"),
    });
    const model = new ChatPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
      model: "sonar-reasoning",
    });

    const modelWithStructuredOutput = model.withStructuredOutput(
      responseSchema,
      {
        name: "reasoning_response",
      }
    );

    const result = await modelWithStructuredOutput.invoke([
      {
        role: "user",
        content: "What are the most popular LLM frameworks?",
      },
    ]);

    expect(result.answer).toBeDefined();
    expect(typeof result.answer).toBe("string");
    expect(result.reasoning).toBeDefined();
    expect(typeof result.reasoning).toBe("string");
    expect(result.confidence).toBeDefined();
    expect(typeof result.confidence).toBe("number");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
