import { describe, it, expect, vi, beforeEach } from "vitest";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { createMiddleware, createAgent, providerStrategy } from "../index.js";

describe("modifyModelRequest", () => {
  it("should allow middleware to update model, messages and systemPrompt", async () => {
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
      modifyModelRequest: async (_request, _state, _runtime) => {
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
          systemPrompt: "You are a geography expert.",
          toolChoice: "none",
          tools: [],
        };
      },
    });

    // Create agent with OpenAI model string and the middleware
    const agent = createAgent({
      model: "gpt-4o-mini",
      tools: [simpleTool],
      middleware: [modelSwitchMiddleware],
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
    // Check that messages were updated
    expect(requestBody.messages).toHaveLength(1);
    expect(requestBody.messages[0]).toEqual({
      role: "user",
      content: expect.stringContaining(
        "I'm working on a comprehensive educational"
      ),
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
    const responseContent = aiResponse?.content?.toString().toLowerCase() || "";
    expect(responseContent).toMatch(/paris|france/i);
    expect(responseContent).not.toMatch(/tokyo|weather/i);
  });

  it("can change tools and toolChoice in modifyModelRequest", async () => {
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
      tools: [weatherTool, newsTool],
      modifyModelRequest: async () => {
        // Set toolChoice to force specific tool
        return {
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
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
      configuration: {
        fetch: openAIFetchMock,
      },
    });

    // Mock the OpenAI response with proper headers
    // First call returns tool call, second call returns final answer
    openAIFetchMock
      .mockImplementationOnce(async () => {
        // First call: Return tool call
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
      })
      .mockImplementationOnce(async () => {
        // Second call: Return final text answer
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers({
            "content-type": "application/json",
          }),
          json: async () => ({
            id: "chatcmpl-test2",
            object: "chat.completion",
            created: Date.now(),
            model: "gpt-4",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: "The weather in New York is sunny and 72 degrees.",
                },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 75,
              completion_tokens: 15,
              total_tokens: 90,
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
      model,
      // No tools provided initially
      tools: [],
      middleware: [toolsMiddleware],
    });

    // Invoke the agent
    const result = await agent.invoke({
      messages: [new HumanMessage("What's the weather in New York?")],
    });

    // Verify the OpenAI API was called with the correct tools and tool_choice
    expect(openAIFetchMock).toHaveBeenCalledTimes(2);
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

    // Verify the result contains the final AI response
    const aiResponse = result.messages[result.messages.length - 1];
    expect(aiResponse).toBeInstanceOf(AIMessage);
    expect((aiResponse as AIMessage).content).toBe(
      "The weather in New York is sunny and 72 degrees."
    );

    // Verify tool call was made in the message history
    const toolCallMessage = result.messages.find(
      (msg) => AIMessage.isInstance(msg) && msg.tool_calls?.length
    ) as AIMessage;
    expect(toolCallMessage).toBeDefined();
    expect(toolCallMessage.tool_calls).toHaveLength(1);
    expect(toolCallMessage.tool_calls?.[0]).toMatchObject({
      name: "getWeather",
      args: { location: "New York" },
      id: "call_test123",
    });
  });
});

describe("structured response format", () => {
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
  const model = new ChatAnthropic({
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

  it("should automatically use provider strategy if the model supports JSON schema output", async () => {
    const weatherTool = tool(
      async (input: { city: string }) => {
        return `Weather in ${input.city}: Sunny, 72°F`;
      },
      {
        name: "getWeather",
        schema: z.object({
          city: z.string(),
        }),
        description: "Get the current weather for a city",
      }
    );

    const agent = createAgent({
      model: "gpt-4o-mini",
      tools: [weatherTool],
      responseFormat: z.object({
        city: z.string(),
        temperature: z.number().describe("The temperature in fahrenheit"),
      }),
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("What's the weather in Tokyo?")],
    });

    expect(result.structuredResponse).toBeDefined();
    expect(result.structuredResponse?.city).toBe("Tokyo");
    expect(result.structuredResponse?.temperature).toBe(72);
    const toolCalls = result.messages
      .filter(
        (msg) =>
          "tool_calls" in msg &&
          Array.isArray(msg.tool_calls) &&
          msg.tool_calls.length > 0
      )
      .map((msg) => (msg as AIMessage).tool_calls)
      .flat() as { name: string }[];
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].name).toBe("getWeather");
  });

  it("should automatically use tool strategy if the model does not support JSON schema output", async () => {
    const weatherTool = tool(
      async (input: { city: string }) => {
        return `Weather in ${input.city}: Sunny, 72°F`;
      },
      {
        name: "getWeather",
        schema: z.object({
          city: z.string(),
        }),
        description: "Get the current weather for a city",
      }
    );

    const agent = createAgent({
      model: "gpt-3.5-turbo",
      tools: [weatherTool],
      responseFormat: z.object({
        city: z.string(),
        temperature: z.number().describe("The temperature in fahrenheit"),
      }),
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("What's the weather in Tokyo?")],
    });

    expect(result.structuredResponse).toBeDefined();
    expect(result.structuredResponse?.city).toBe("Tokyo");
    expect(result.structuredResponse?.temperature).toBe(72);
    const toolCalls = result.messages
      .filter(
        (msg) =>
          "tool_calls" in msg &&
          Array.isArray(msg.tool_calls) &&
          msg.tool_calls.length > 0
      )
      .map((msg) => (msg as AIMessage).tool_calls)
      .flat() as { name: string }[];
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].name).toBe("getWeather");
    expect(toolCalls[1].name).toContain("extract-");
  });

  it("simple tool use without any middleware", async () => {
    const weatherTool = tool(
      async (input: { city: string }) => {
        return `Weather in ${input.city}: Sunny, 72°F`;
      },
      {
        name: "getWeather",
        schema: z.object({
          city: z.string(),
        }),
        description: "Get the current weather for a city",
      }
    );

    const agent = createAgent({
      model: "gpt-4o-mini",
      tools: [weatherTool],
      middleware: [],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("What's the weather in Tokyo?")],
    });

    expect(result.messages.at(-1)?.content).toContain("72°F");
  });

  it("should work with Anthropic and return structured response", async () => {
    const agent = createAgent({
      model,
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

  it("should throw if a user tries to use native response format with Anthropic", async () => {
    const agent = createAgent({
      model,
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
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      configuration: {
        fetch: fetchMock,
      },
    });

    const agent = createAgent({
      model,
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
});
