import { z } from "zod";
import { describe, it, expect } from "vitest";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";

import { createAgent } from "../../index.js";
import { llmToolSelectorMiddleware } from "../llmToolSelector.js";

const getWeather = tool(
  ({ location }: { location: string }) => `Weather in ${location}: Sunny, 72°F`,
  {
    name: "get_weather",
    description: "Get current weather for a location",
    schema: z.object({
      location: z.string().describe("City name"),
    }),
  }
);

const searchDatabase = tool(
  ({ customerId }: { customerId: string }) =>
    `Customer ${customerId}: Premium account`,
  {
    name: "search_database",
    description: "Look up customer information by customer ID",
    schema: z.object({
      customerId: z.string().describe("Customer ID"),
    }),
  }
);

const calculatePrice = tool(
  ({ items, discount }: { items: number; discount: number }) =>
    `Total: $${(items * 29.99 * (1 - discount / 100)).toFixed(2)}`,
  {
    name: "calculate_price",
    description: "Calculate pricing with discounts",
    schema: z.object({
      items: z.number(),
      discount: z.number(),
    }),
  }
);

const allTools = [getWeather, searchDatabase, calculatePrice];

describe("llmToolSelectorMiddleware – streaming isolation (integration)", () => {
  it("does not leak tool-selector output into messages stream", async () => {
    const middleware = llmToolSelectorMiddleware({
      model: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
      maxTools: 1,
    });

    const agent = createAgent({
      model: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
      tools: allTools,
      middleware: [middleware],
    });

    const stream = await agent.stream(
      { messages: [new HumanMessage("What's the weather in Seoul?")] },
      { streamMode: "messages" }
    );

    const parts: string[] = [];
    for await (const chunk of stream) {
      parts.push(JSON.stringify(chunk));
    }
    const serialized = parts.join("");

    const hasToolSelectorLeak =
      serialized.includes('"content":"{\\"tools') ||
      serialized.includes('"content":"tools') ||
      /"content":"[^"]*tools[^"]*","tool_call_chunks":\[\]/.test(serialized);

    expect(hasToolSelectorLeak).toBe(false);
  });
});
