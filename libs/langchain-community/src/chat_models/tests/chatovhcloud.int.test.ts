import { describe, test, expect } from "@jest/globals";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod/v3";

import { ChatOVHCloudAIEndpoints } from "../ovhcloud.js";

const model = "gpt-oss-120b";

describe("ChatOVHCloudAIEndpoints", () => {
  test("should call ChatOVHCloudAIEndpoints", async () => {
    const chat = new ChatOVHCloudAIEndpoints({
      model,
    });
    const message = new HumanMessage("What is the capital of France?");
    const response = await chat.invoke([message], {});
    expect(response.content.length).toBeGreaterThan(10);
  });

  test("aggregated response using streaming", async () => {
    const chat = new ChatOVHCloudAIEndpoints({
      model,
      streaming: true,
    });
    const message = new HumanMessage("What is the capital of France?");
    const response = await chat.invoke([message], {});
    expect(response.content.length).toBeGreaterThan(10);
  });

  test("use invoke", async () => {
    const chat = new ChatOVHCloudAIEndpoints({
      model,
    });
    const response = await chat.invoke("What is the capital of France?");
    expect(response.content.length).toBeGreaterThan(10);
  });

  test("should handle streaming", async () => {
    const chat = new ChatOVHCloudAIEndpoints({
      streaming: true,
      model,
    });
    const message = new HumanMessage("What is the capital of France?");
    const stream = await chat.stream([message], {});
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.content).join("")).toContain("Paris");
  });

  test("should handle system messages", async () => {
    const chat = new ChatOVHCloudAIEndpoints({
      model,
    });
    const messages = [
      new SystemMessage("You are a geography expert."),
      new HumanMessage("What is the capital of France?"),
    ];
    const response = await chat.invoke(messages);
    expect(response.content.length).toBeGreaterThan(10);
  });

  test("structured output", async () => {
    const chat = new ChatOVHCloudAIEndpoints({
      model,
    }).withStructuredOutput(
      z.object({
        capital: z.string(),
        country: z.string(),
      })
    );
    const messages = [
      new SystemMessage("You are a geography expert."),
      new HumanMessage("What is the capital of France? Return JSON."),
    ];
    const response = await chat.invoke(messages);
    expect(response.capital).toBe("Paris");
    expect(response.country).toBe("France");
  });

  test("reasoning model with structured output", async () => {
    const chat = new ChatOVHCloudAIEndpoints({
      model,
    }).withStructuredOutput(
      z.object({
        capital: z.string(),
        country: z.string(),
      }),
      {
        name: "reasoning_response",
      }
    );

    const messages = [
      new SystemMessage("You are a geography expert."),
      new HumanMessage("What is the capital of France? Return JSON."),
    ];
    const response = await chat.invoke(messages);
    expect(response.capital).toBe("Paris");
    expect(response.country).toBe("France");
  });
});
