import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  isHumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import z from "zod/v3";

import { createAgent, providerStrategy, createMiddleware } from "../index.js";
import { anthropicPromptCachingMiddleware } from "../middlewareAgent/middleware/promptCaching.js";

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
        if (lastMessage && isHumanMessage(lastMessage)) {
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

  describe.only("prepareModelRequest", () => {
    it("should allow middleware to update model, messages, systemMessage, and modelSettings", async () => {
      // Setup mocked fetch functions for both providers
      const openAIFetchMock = vi.fn((url, options) => fetch(url, options));
      const anthropicFetchMock = vi.fn((url, options) => fetch(url, options));

      // Create a simple tool for testing
      const simpleTool = tool(
        async (input: { query: string }) => {
          return `Tool response for: ${input.query}`;
        },
        {
          name: "simpleTool",
          schema: z.object({
            query: z.string().describe("The query to process"),
          }),
          description: "A simple tool for testing",
        }
      );

      // Create middleware that will change the model and messages
      const modelSwitchMiddleware = createMiddleware({
        name: "modelSwitcher",
        prepareModelRequest: async (_request, _state, _runtime) => {
          // Create a new ChatAnthropic instance
          const anthropicModel = new ChatAnthropic({
            model: "claude-3-5-sonnet-20240620",
            clientOptions: {
              fetch: anthropicFetchMock,
            },
          });

          // Change the messages to ask a completely different question
          const newMessages = [
            new HumanMessage("What is the capital of France?"),
          ];

          // Set model settings including cache_control for Anthropic prompt caching
          const modelSettings = {
            temperature: 0.7,
            maxTokens: 500,
            topP: 0.95,
            metadata: {
              cache_control: {
                type: "ephemeral",
                ttl: "5m",
              },
            },
          };

          // Return partial ModelRequest - tools will be merged from original request
          return {
            model: anthropicModel,
            messages: newMessages,
            systemMessage: new SystemMessage("You are a geography expert."),
            modelSettings,
            tools: _request.tools,
          };
        },
      });

      // Create agent with OpenAI model string and the middleware
      const agent = createAgent({
        model: "gpt-4o-mini",
        tools: [simpleTool],
        middleware: [
          modelSwitchMiddleware,
          anthropicPromptCachingMiddleware({
            ttl: "5m",
            minMessagesToCache: 1,
          }),
        ] as const,
      });

      // Invoke the agent
      const result = await agent.invoke({
        messages: [new HumanMessage("What's the weather in Tokyo?")],
      });

      // Verify that Anthropic was called (not OpenAI)
      expect(anthropicFetchMock).toHaveBeenCalled();
      expect(openAIFetchMock).not.toHaveBeenCalled();

      // Verify the request to Anthropic includes our model settings
      const anthropicCall = anthropicFetchMock.mock.calls[0];
      const requestBody = JSON.parse(anthropicCall[1].body);

      // Check that model settings were propagated
      expect(requestBody.temperature).toBe(0.7);
      expect(requestBody.max_tokens).toBe(500);
      expect(requestBody.top_p).toBe(0.95);
      // Check that cache_control was passed through
      expect(requestBody.system.at(-1).cache_control).toEqual({
        type: "ephemeral",
        ttl: "5m",
      });

      // Check that the system message was updated
      expect(requestBody.system).toEqual([
        expect.objectContaining({
          type: "text",
          text: "You are a geography expert.",
        }),
      ]);

      // Check that messages were changed to ask about France
      const userMessage = requestBody.messages.find(
        (msg: { role: string }) => msg.role === "user"
      );
      expect(userMessage.content).toBe("What is the capital of France?");

      // The response should be about France, not Tokyo weather
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);

      // Find the AI response message
      const aiResponse = result.messages.find((msg) => msg.type === "ai");
      expect(aiResponse).toBeDefined();
      // The response should mention Paris or France, not Tokyo or weather
      const responseContent =
        aiResponse?.content?.toString().toLowerCase() || "";
      expect(responseContent).toMatch(/paris|france/i);
      expect(responseContent).not.toMatch(/tokyo|weather/i);
    });
  });
});
