import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import z from "zod/v3";

import { createAgent, providerStrategy } from "../index.js";

describe("createAgent Integration Tests", () => {
  const toolMock = vi.fn(async (input: { city: string }) => {
    return `It's always sunny in ${input.city}!`;
  });
  const toolSchema = {
    name: "getWeather",
    schema: z.object({
      city: z.string().describe("The city to get the weather for"),
    }),
    description: "Get weather for a given city",
  };
  const getWeather = tool(toolMock, toolSchema);
  const fetchMock = vi.fn(fetch);
  const llm = new ChatAnthropic({
    model: "claude-3-5-sonnet-20240620",
    clientOptions: {
      fetch: fetchMock,
    },
  });

  const answerSchema = z.object({
    answer: z.enum(["yes", "no"]).describe("Whether the weather is sunny"),
    city: z.string().describe("The city that was queried"),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should work with Anthropic and return structured response", async () => {
    const agent = createAgent({
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

    // validate that the tool was called at least once
    expect(toolMock).toHaveBeenCalledTimes(1);
    // given we are using tool output as response format, we expect at least 2 LLM calls
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should work with model option", async () => {
    const agent = createAgent({
      model: "claude-3-5-sonnet-20240620",
      tools: [getWeather],
      responseFormat: answerSchema,
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("What's the weather in Tokyo?")],
    });

    expect(result.structuredResponse).toBeDefined();
    expect(result.structuredResponse?.answer).toBe("yes");
    expect(result.structuredResponse?.city).toBe("Tokyo");
  });

  it("should throw if a user tries to use native response format with Anthropic", async () => {
    const agent = createAgent({
      llm,
      tools: [getWeather],
      responseFormat: providerStrategy(answerSchema),
    });

    await expect(
      agent.invoke({
        messages: [new HumanMessage("What's the weather in Tokyo?")],
      })
    ).rejects.toThrow(
      /Model does not support native structured output responses/
    );
  });

  it("should support native response format with OpenAI", async () => {
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
      configuration: {
        fetch: fetchMock,
      },
    });

    const agent = createAgent({
      llm,
      tools: [getWeather],
      responseFormat: providerStrategy(answerSchema),
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("What's the weather in Tokyo?")],
    });

    expect(result.structuredResponse).toBeDefined();
    expect(result.structuredResponse?.answer).toBe("yes");
    expect(result.structuredResponse?.city).toBe("Tokyo");
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    // validate that the tool was called at least once
    expect(toolMock).toHaveBeenCalledTimes(1);
    // given we are using tool output as response format, we expect at least 2 LLM calls
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

    const agent = createAgent({
      llm,
      tools: [calculator],
      responseFormat: resultSchema,
      preModelHook: (state) => {
        preHookCalled = true;
        preHookMessageCount = state.messages.length;
        const lastMessage = state.messages.at(-1);

        // Modify the query
        if (lastMessage && HumanMessage.isInstance(lastMessage)) {
          state.messages[state.messages.length - 1].content =
            "What is 15 multiplied by 8?";
        }

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

  describe("stateSchema", () => {
    it("should allow to reduce zod fields automatically if zod schema is provided", async () => {
      const stateSchema = z.object({
        hookCalls: z.number().describe("The number of hook calls"),
        foobar: z.string().describe("The foobar").default("default foobar"),
        someEnum: z.enum(["a", "b", "c"]).describe("The someEnum").default("a"),
        someNumber: z.number().describe("The someNumber"),
        someOptionalNumber: z
          .number()
          .describe("The someOptionalNumber")
          .optional(),
      });

      const toolA = tool(async () => "Tool A", {
        name: "toolA",
        description: "Tool A",
      });

      const toolB = tool(async () => "Tool B", {
        name: "toolB",
        description: "Tool B",
      });

      const agent = createAgent({
        model: "gpt-4o-mini",
        tools: [toolA, toolB],
        postModelHook: (state) => {
          return {
            hookCalls: state.hookCalls + 1,
            someEnum: "b" as const,
          };
        },
        stateSchema,
      });

      const response = await agent.invoke({
        messages: ["Give me the results of toolA and toolB"],
      });

      /**
       * 5 messages:
       * 1. Human message
       * 2. Tool call
       * 3. Tool result
       * 4. Tool call
       * 5. Tool result
       */
      expect(response.messages).toHaveLength(5);
      expect(response.hookCalls).toBe(2);
      expect(response.foobar).toBe("default foobar");
      expect(response.someEnum).toBe("b");
      expect(response.someNumber).toBe(0); // expect 0 because it's not set as optional in the schema
      expect(response.someOptionalNumber).toBe(undefined);
    });
  });
});
