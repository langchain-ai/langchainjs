import { z } from "zod";
import { describe, it, expect } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import { createAgent } from "../../index.js";
import { providerToolSearchMiddleware } from "../providerToolSearch.js";

const getWeather = tool(async () => "Sunny, 22C", {
  name: "get_weather",
  description: "Get the current weather for a city",
  schema: z.object({ city: z.string() }),
});

const lookupOrderStatus = tool(
  async () => "OUT_FOR_DELIVERY, arriving Tuesday",
  {
    name: "lookup_order_status",
    description:
      "Look up the current delivery status of a customer order by ID",
    schema: z.object({ orderId: z.string() }),
  }
);

/** Whether any assistant turn issued a tool call for `name`. */
function calledTool(messages: BaseMessage[], name: string): boolean {
  return messages.some(
    (m) =>
      m instanceof AIMessage &&
      (m.tool_calls ?? []).some((tc) => tc.name === name)
  );
}

describe("providerToolSearchMiddleware", () => {
  it("Anthropic discovers and calls a deferred tool via server-side search", async () => {
    const agent = createAgent({
      model: new ChatAnthropic({ model: "claude-opus-4-7" }),
      tools: [getWeather, lookupOrderStatus],
      middleware: [
        providerToolSearchMiddleware({
          searchableTools: ["lookup_order_status"],
        }),
      ],
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage("What is the delivery status of order A1234?"),
      ],
    });

    expect(calledTool(result.messages, "lookup_order_status")).toBe(true);
  }, 60_000);

  it("OpenAI discovers and calls a deferred tool via server-side search", async () => {
    const agent = createAgent({
      model: new ChatOpenAI({ model: "gpt-5.4" }),
      tools: [getWeather, lookupOrderStatus],
      middleware: [
        providerToolSearchMiddleware({
          searchableTools: ["lookup_order_status"],
        }),
      ],
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage("What is the delivery status of order A1234?"),
      ],
    });

    expect(calledTool(result.messages, "lookup_order_status")).toBe(true);
  }, 60_000);

  it("surfaces OpenAI's API error for a model below the tool-search threshold", async () => {
    const agent = createAgent({
      model: new ChatOpenAI({ model: "gpt-4o" }),
      tools: [getWeather, lookupOrderStatus],
      middleware: [
        providerToolSearchMiddleware({
          searchableTools: ["lookup_order_status"],
        }),
      ],
    });

    await expect(
      agent.invoke({
        messages: [
          new HumanMessage("What is the delivery status of order A1234?"),
        ],
      })
    ).rejects.toThrow();
  }, 60_000);
});
