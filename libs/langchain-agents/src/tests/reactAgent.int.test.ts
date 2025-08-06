import { describe, it, expect } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import z from "zod";

import { createReactAgent } from "../index.js";

describe("createReactAgent Integration Tests", () => {
  it("should work with Anthropic and return structured response", async () => {
    const llm = new ChatAnthropic({ model: "claude-3-5-sonnet-20240620" });

    const getWeather = tool(
      async (input: { city: string }) => {
        return `It's always sunny in ${input.city}!`;
      },
      {
        name: "getWeather",
        schema: z.object({
          city: z.string().describe("The city to get the weather for"),
        }),
        description: "Get weather for a given city",
      }
    );

    const answerSchema = z.object({
      answer: z.enum(["yes", "no"]).describe("Whether the weather is sunny"),
      city: z.string().describe("The city that was queried"),
    });

    const agent = createReactAgent({
      llm,
      tools: [getWeather],
      responseFormat: answerSchema,
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("What's the weather in Tokyo?")],
    });

    expect(result.structuredResponse).toBeDefined();
    expect(result.structuredResponse?.answer).toBe("yes");
    expect(result.structuredResponse?.city).toBe("Tokyo");
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("should work with preModelHook and postModelHook", async () => {
    const llm = new ChatAnthropic({ model: "claude-3-5-sonnet-20240620" });

    const calculator = tool(
      async (input: { operation: string; a: number; b: number }) => {
        switch (input.operation) {
          case "add":
            return `${input.a} + ${input.b} = ${input.a + input.b}`;
          case "multiply":
            return `${input.a} * ${input.b} = ${input.a * input.b}`;
          default:
            return "Unknown operation";
        }
      },
      {
        name: "calculator",
        schema: z.object({
          operation: z
            .enum(["add", "multiply"])
            .describe("The operation to perform"),
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
        description: "Perform basic math operations",
      }
    );

    const resultSchema = z.object({
      calculation: z.string().describe("The calculation performed"),
      result: z.number().describe("The numerical result"),
    });

    let preHookCalled = false;
    let postHookCalled = false;
    let preHookMessageCount = 0;
    let postHookMessageCount = 0;

    const agent = createReactAgent({
      llm,
      tools: [calculator],
      responseFormat: resultSchema,
      preModelHook: (state) => {
        preHookCalled = true;
        preHookMessageCount = state.messages.length;

        // Modify the query
        // eslint-disable-next-line no-param-reassign
        state.messages[state.messages.length - 1].content =
          "What is 15 multiplied by 8?";

        return state;
      },
      postModelHook: (state) => {
        postHookCalled = true;
        postHookMessageCount = state.messages.length;
        return state;
      },
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("What is 15 multiplied by 7?")],
    });

    // Validate hooks were called
    expect(preHookCalled).toBe(true);
    expect(postHookCalled).toBe(true);

    // Validate hook execution order and state changes
    expect(preHookMessageCount).toBeGreaterThan(0);
    expect(postHookMessageCount).toBeGreaterThan(preHookMessageCount);

    // Validate structured response
    expect(result.structuredResponse).toBeDefined();
    expect(result.structuredResponse?.result).toBe(120);
    expect(result.structuredResponse?.calculation).toContain("15");
    expect(result.structuredResponse?.calculation).toContain("8");
  });
});
