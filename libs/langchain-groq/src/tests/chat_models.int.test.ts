import { z } from "zod";
import { describe, test } from "@jest/globals";

import { HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { ChatGroq } from "../chat_models.js";

describe("ChatGroq", () => {
  test("invoke", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("What color is the sky?");
    const res = await chat.invoke([message]);
    console.log({ res });
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("invoke with stop sequence", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("Count to ten.");
    const res = await chat.bind({ stop: ["5", "five"] }).invoke([message]);
    console.log({ res });
    expect((res.content as string).toLowerCase()).not.toContain("6");
    expect((res.content as string).toLowerCase()).not.toContain("six");
  });

  test("invoke should respect passed headers", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("Count to ten.");
    await expect(async () => {
      await chat.invoke([message], {
        headers: { Authorization: "badbadbad" },
      });
    }).rejects.toThrowError();
  });

  test("stream should respect passed headers", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("Count to ten.");
    await expect(async () => {
      await chat.stream([message], {
        headers: { Authorization: "badbadbad" },
      });
    }).rejects.toThrowError();
  });

  test("generate", async () => {
    const chat = new ChatGroq();
    const message = new HumanMessage("Hello!");
    const res = await chat.generate([[message]]);
    console.log(JSON.stringify(res, null, 2));
    expect(res.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("streaming", async () => {
    const chat = new ChatGroq();
    const message = new HumanMessage("What color is the sky?");
    const stream = await chat.stream([message]);
    let iters = 0;
    let finalRes = "";
    for await (const chunk of stream) {
      iters += 1;
      finalRes += chunk.content;
    }
    console.log({ finalRes, iters });
    expect(iters).toBeGreaterThan(1);
  });

  test("invoke with bound tools", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
      modelName: "mixtral-8x7b-32768",
    });
    const message = new HumanMessage("What is the current weather in Hawaii?");
    const res = await chat
      .bind({
        tools: [
          {
            type: "function",
            function: {
              name: "get_current_weather",
              description: "Get the current weather in a given location",
              parameters: {
                type: "object",
                properties: {
                  location: {
                    type: "string",
                    description: "The city and state, e.g. San Francisco, CA",
                  },
                  unit: { type: "string", enum: ["celsius", "fahrenheit"] },
                },
                required: ["location"],
              },
            },
          },
        ],
        tool_choice: "auto",
      })
      .invoke([message]);
    console.log(JSON.stringify(res));
    expect(res.additional_kwargs.tool_calls?.length).toBeGreaterThan(0);
  });

  test.skip("Model is compatible with OpenAI tools agent and Agent Executor", async () => {
    const llm = new ChatGroq({
      temperature: 0,
      modelName: "mixtral-8x7b-32768",
    });
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are an agent capable of retrieving current weather information.",
      ],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"],
    ]);

    const currentWeatherTool = new DynamicStructuredTool({
      name: "get_current_weather",
      description: "Get the current weather in a given location",
      schema: z.object({
        location: z
          .string()
          .describe("The city and state, e.g. San Francisco, CA"),
      }),
      func: async () => Promise.resolve("28 °C"),
    });

    const agent = await createOpenAIToolsAgent({
      llm,
      tools: [currentWeatherTool],
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools: [currentWeatherTool],
    });

    const input = "What's the weather like in Paris?";
    const { output } = await agentExecutor.invoke({ input });

    console.log(output);
    expect(output).toBeDefined();
    expect(output).toContain("The current temperature in Paris is 28 °C");
  });

  test("stream with bound tools, yielding a single chunk", async () => {
    const chat = new ChatGroq({
      maxRetries: 0,
    });
    const message = new HumanMessage("What is the current weather in Hawaii?");
    const stream = await chat
      .bind({
        tools: [
          {
            type: "function",
            function: {
              name: "get_current_weather",
              description: "Get the current weather in a given location",
              parameters: {
                type: "object",
                properties: {
                  location: {
                    type: "string",
                    description: "The city and state, e.g. San Francisco, CA",
                  },
                  unit: { type: "string", enum: ["celsius", "fahrenheit"] },
                },
                required: ["location"],
              },
            },
          },
        ],
        tool_choice: "auto",
      })
      .stream([message]);
    for await (const chunk of stream) {
      console.log(JSON.stringify(chunk));
    }
  });
});
