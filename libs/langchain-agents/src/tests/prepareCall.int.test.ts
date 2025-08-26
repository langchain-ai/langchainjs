import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

import { createAgent } from "../index.js";

// Mock tool for testing
const getWeather = tool(
  (input) => {
    if (["sf", "san francisco"].includes(input.location.toLowerCase())) {
      return "It's 60 degrees and foggy.";
    } else {
      return "It's 90 degrees and sunny.";
    }
  },
  {
    name: "get_weather",
    description: "Call to get the current weather.",
    schema: z.object({
      location: z.string().describe("Location to get the weather for."),
    }),
  }
);

const getTime = tool(
  () => {
    return new Date().toISOString();
  },
  {
    name: "get_time",
    description: "Get the current time.",
    schema: z.object({}),
  }
);

const fetchMock = vi.fn(fetch);

describe("prepareCall hook", () => {
  beforeEach(() => {
    fetchMock.mockClear();
  });

  it("should dynamically change system message based on state", async () => {
    const userMessage = "What's the weather in SF?";
    const systemMessage = "You are a helpful weather assistant.";
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
      configuration: {
        fetch: fetchMock,
      },
    });

    const agent = createAgent({
      llm: model,
      tools: [getWeather, getTime],
      experimental_prepareCall: async (options) => {
        const { stepNumber } = options;

        // Capture the system message for testing
        if (stepNumber === 0) {
          return {
            systemMessage,
          };
        }

        return {};
      },
    });

    const messages = [new HumanMessage(userMessage)];

    await agent.invoke({ messages });
    const bodyPayloads = fetchMock.mock.calls.map((call) =>
      JSON.parse(call[1]?.body as string)
    );
    expect(bodyPayloads[0].messages[0].content).toBe(systemMessage);
    expect(bodyPayloads[1].messages[0].content).toBe(userMessage);
  });

  it("should force specific tool on first step", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
      configuration: {
        fetch: fetchMock,
      },
    });

    const toolChoice = {
      type: "function",
      function: { name: "get_weather" },
    } as const;

    const agent = createAgent({
      llm: model,
      tools: [getWeather, getTime],
      experimental_prepareCall: async (options) => {
        const { stepNumber } = options;

        if (stepNumber === 0) {
          return {
            toolChoice,
          };
        }

        return {};
      },
    });

    const messages = [
      new HumanMessage("What time is it?"), // Asking for time, but we'll force weather tool
    ];

    await agent.invoke({ messages });
    const bodyPayloads = fetchMock.mock.calls.map((call) =>
      JSON.parse(call[1]?.body as string)
    );
    expect(bodyPayloads[0].tool_choice).toEqual(toolChoice);
    expect(bodyPayloads[1]).not.toHaveProperty("tool_choice");
  });

  it("should dynamically filter available tools", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
      configuration: {
        fetch: fetchMock,
      },
    });

    const agent = createAgent({
      llm: model,
      tools: [getWeather, getTime],
      experimental_prepareCall: async (options) => {
        const { messages } = options;

        // Only allow weather tool if user asks about weather
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.getType() === "human") {
          const content = lastMessage.content as string;
          if (content.toLowerCase().includes("weather")) {
            return {
              tools: ["get_weather"],
            };
          } else if (content.toLowerCase().includes("time")) {
            return {
              tools: ["get_time"],
            };
          }

          throw new Error("I can't help with that.");
        }

        return {};
      },
    });

    const weatherMessages = [new HumanMessage("What's the weather?")];
    await agent.invoke({ messages: weatherMessages });
    const bodyPayloads = fetchMock.mock.calls.map((call) =>
      JSON.parse(call[1]?.body as string)
    );
    expect(bodyPayloads[0].tools).toHaveLength(1);
    expect(bodyPayloads[0].tools[0]).toMatchObject({
      function: {
        name: "get_weather",
        description: "Call to get the current weather.",
      },
    });

    fetchMock.mockClear();

    const timeMessages = [new HumanMessage("What time is it?")];
    await agent.invoke({ messages: timeMessages });
    const bodyPayloads2 = fetchMock.mock.calls.map((call) =>
      JSON.parse(call[1]?.body as string)
    );
    expect(bodyPayloads2[0].tools).toHaveLength(1);
    expect(bodyPayloads2[0].tools[0]).toMatchObject({
      function: {
        name: "get_time",
        description: "Get the current time.",
      },
    });

    const errorMessages = [new HumanMessage("Tell me a joke.")];
    await expect(agent.invoke({ messages: errorMessages })).rejects.toThrow(
      "I can't help with that."
    );
  });

  it("should track LLM calls and tool calls", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
    });

    let trackedLLMCalls = 0;

    const agent = createAgent({
      llm: model,
      tools: [getWeather],
      experimental_prepareCall: async (options) => {
        const { llmCalls } = options;

        trackedLLMCalls = llmCalls.length;

        return {};
      },
    });

    const messages = [new HumanMessage("What's the weather in SF?")];
    await agent.invoke({ messages });
    expect(trackedLLMCalls).toBe(2);
  });

  it("should not allow prepareCall with callable prompt", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
    });

    expect(() => {
      createAgent({
        llm: model,
        tools: [getWeather],
        prompt: async () => {
          return [new HumanMessage("Custom prompt")];
        },
        experimental_prepareCall: async () => {
          return {};
        },
      });
    }).toThrow("Cannot specify both 'prepareCall' and a callable 'prompt'");
  });

  it("should work with runtime context", async () => {
    expect.assertions(1);
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
    });

    const customRuntime = { userId: "123", sessionId: "abc" };

    const agent = createAgent({
      llm: model,
      tools: [getWeather],
      experimental_prepareCall: async (_, runtime) => {
        expect(runtime).toBe(customRuntime);
        return {};
      },
    });

    const messages = [new HumanMessage("What's the weather?")];
    await agent.invoke(
      { messages },
      { configurable: { runtime: customRuntime } }
    );
  });
});
