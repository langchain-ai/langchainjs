import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  isHumanMessage,
  SystemMessage,
  AIMessage,
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

  describe("prepareModelRequest", () => {
    it("should allow middleware to update model, messages and systemMessage", async () => {
      // Setup mocked fetch functions for both providers
      const openAIFetchMock = vi.fn((url, options) => fetch(url, options));
      const anthropicResponse = vi.fn((res) => res.clone());
      const anthropicFetchMock = vi.fn((url, options) =>
        fetch(url, options).then(anthropicResponse)
      );

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
            model: "claude-opus-4-20250514",
            temperature: 0.7,
            maxTokens: 500,
            topP: 0.95,
            clientOptions: {
              fetch: anthropicFetchMock,
            },
          });

          // Change the messages to ask a completely different question
          const newMessages = [
            new HumanMessage(`I'm working on a comprehensive educational project about European capitals and their historical significance. I need detailed and accurate information for my research, which will be published in an upcoming textbook for high school students studying world geography and history.

Before I ask my specific question, let me provide extensive context about the subject matter: France is a Western European country with a rich history spanning over millennia. It has been a major cultural, political, and economic power throughout history. The country has played a pivotal role in the development of Western civilization, from the Renaissance through the Enlightenment to modern times. The nation's influence extends far beyond its borders, shaping global politics, culture, and intellectual thought for centuries.

France is renowned worldwide for its extraordinary contributions to art, science, philosophy, cuisine, fashion, and literature. The country has produced countless influential figures including philosophers like René Descartes, Voltaire, Jean-Jacques Rousseau, and Simone de Beauvoir; scientists like Marie Curie, Louis Pasteur, Blaise Pascal, and Henri Poincaré; writers like Victor Hugo, Marcel Proust, Albert Camus, and Marguerite Duras; and artists like Claude Monet, Auguste Rodin, Edgar Degas, and Henri Matisse. The French Revolution of 1789 had a profound and lasting impact on the development of modern democratic ideals, human rights, and political philosophy across the globe.

The country is administratively divided into several distinct regions, each with its own unique culture, dialect, culinary traditions, and historical significance. From the aromatic lavender fields of Provence to the world-famous vineyards of Bordeaux, from the glamorous beaches of the Côte d'Azur to the majestic peaks of the Alps and Pyrenees, France offers incredible geographical and cultural diversity. The Loire Valley is known for its magnificent châteaux, Brittany for its Celtic heritage, Normandy for its D-Day beaches and apple orchards, and Alsace for its unique Franco-German culture.

France's economy is one of the world's largest, with strong sectors in aerospace, automotive, luxury goods, tourism, and agriculture. The country is famous for its haute cuisine, which UNESCO recognized as an Intangible Cultural Heritage of Humanity. French wines, cheeses, and pastries are celebrated globally. The French language itself has been a lingua franca of diplomacy, culture, and international relations for centuries, and continues to be one of the working languages of many international organizations.

The educational system in France has produced numerous Nobel laureates, Fields Medal winners, and other distinguished scholars. French universities like the Sorbonne have been centers of learning since the Middle Ages. The country's commitment to arts and culture is evident in its numerous world-class museums, including the Louvre, Musée d'Orsay, and Centre Pompidou, as well as its vibrant theater, cinema, and music scenes.

In terms of governance, France is a unitary semi-presidential republic with a strong democratic tradition. The country is a founding member of the European Union and plays a crucial role in European and global politics. It maintains significant cultural and economic ties with francophone countries around the world through organizations like La Francophonie.

Now, for my comprehensive educational project that requires accurate and reliable information about European capitals, I need to know the answer to this fundamental question: What is the capital of France?

Please provide a clear, direct, and authoritative answer, as this information will be used in an educational context for students learning about European geography, and accuracy is of paramount importance for their academic development.`),
          ];

          // Return partial ModelRequest - tools will be merged from original request
          return {
            model: anthropicModel,
            messages: newMessages,
            systemMessage: new SystemMessage("You are a geography expert."),
            toolChoice: "none",
            tools: [],
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
      expect(requestBody.messages).toHaveLength(1);
      expect(requestBody.messages.at(-1).content[0]).toEqual({
        type: "text",
        text: expect.stringContaining("What is the capital of France?"),
        cache_control: {
          type: "ephemeral",
          ttl: "5m",
        },
      });

      // Check that the system message was updated
      expect(requestBody.system).toBe("You are a geography expert.");

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

      // validate raw response has cache_control set
      const rawResponse = await anthropicResponse.mock.calls[0][0].json();
      // tokens will be already cached when the same test is run again within a short time period
      // so we expect them to be either in the creation or read bucket
      const cachedTokens =
        rawResponse.usage.cache_creation_input_tokens ||
        rawResponse.usage.cache_read_input_tokens;
      expect(cachedTokens).toBe(1195);
    });

    it("can change tools and toolChoice in prepareModelRequest", async () => {
      // Setup mocked fetch for OpenAI
      const openAIFetchMock = vi.fn();

      // Create tools that will be added by middleware
      const weatherTool = tool(
        async (input: { location: string }) => {
          return `Weather in ${input.location}: Sunny, 72°F`;
        },
        {
          name: "getWeather",
          schema: z.object({
            location: z.string().describe("The location to get weather for"),
          }),
          description: "Get the current weather for a location",
        }
      );

      const newsTool = tool(
        async (input: { topic: string }) => {
          return `Latest news on ${input.topic}: Breaking developments...`;
        },
        {
          name: "getNews",
          schema: z.object({
            topic: z.string().describe("The topic to get news about"),
          }),
          description: "Get the latest news on a topic",
        }
      );

      // Create middleware that adds tools and sets toolChoice
      const toolsMiddleware = {
        name: "toolsModifier",
        prepareModelRequest: async () => {
          // Add tools dynamically
          const tools = [weatherTool, newsTool];

          // Set toolChoice to force specific tool
          return {
            tools,
            toolChoice: {
              type: "function" as const,
              function: {
                name: "getWeather",
              },
            },
          };
        },
      };

      // Create OpenAI model initially without any tools
      const openAIModel = new ChatOpenAI({
        model: "gpt-4",
        temperature: 0,
        configuration: {
          fetch: openAIFetchMock,
        },
      });

      // Mock the OpenAI response with proper headers
      openAIFetchMock.mockImplementation(async () => {
        // Return a proper Response-like object
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers({
            "content-type": "application/json",
          }),
          json: async () => ({
            id: "chatcmpl-test",
            object: "chat.completion",
            created: Date.now(),
            model: "gpt-4",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_test123",
                      type: "function",
                      function: {
                        name: "getWeather",
                        arguments: JSON.stringify({ location: "New York" }),
                      },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
            usage: {
              prompt_tokens: 50,
              completion_tokens: 20,
              total_tokens: 70,
            },
          }),
          text: async () => "",
          arrayBuffer: async () => new ArrayBuffer(0),
          blob: async () => new Blob(),
          clone: () => ({}),
          body: null,
          bodyUsed: false,
        };
      });

      // Create agent with the middleware
      const agent = createAgent({
        llm: openAIModel,
        // No tools provided initially
        tools: [],
        middleware: [toolsMiddleware],
      });

      // Invoke the agent
      const result = await agent.invoke({
        messages: [new HumanMessage("What's the weather in New York?")],
      });

      // Verify the OpenAI API was called with the correct tools and tool_choice
      expect(openAIFetchMock).toHaveBeenCalledOnce();
      const [, options] = openAIFetchMock.mock.calls[0];
      const requestBody = JSON.parse(options.body);

      // Check that tools were added
      expect(requestBody.tools).toHaveLength(2);
      expect(requestBody.tools[0]).toMatchObject({
        type: "function",
        function: {
          name: "getWeather",
          description: "Get the current weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The location to get weather for",
              },
            },
            required: ["location"],
            additionalProperties: false,
          },
        },
      });
      expect(requestBody.tools[1]).toMatchObject({
        type: "function",
        function: {
          name: "getNews",
          description: "Get the latest news on a topic",
        },
      });

      // Check that tool_choice was set correctly
      expect(requestBody.tool_choice).toEqual({
        type: "function",
        function: { name: "getWeather" },
      });

      // Verify the result contains the tool call
      const aiResponse = result.messages[result.messages.length - 1];
      expect(aiResponse).toBeInstanceOf(AIMessage);
      expect((aiResponse as AIMessage).tool_calls).toHaveLength(1);
      expect((aiResponse as AIMessage).tool_calls?.[0]).toMatchObject({
        name: "getWeather",
        args: { location: "New York" },
        id: "call_test123",
      });
    });
  });
});
