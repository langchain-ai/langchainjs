import { test, expect, describe } from "vitest";
import { z } from "zod/v3";

import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { concat } from "@langchain/core/utils/stream";

import { ChatXAI } from "../chat_models.js";
import {
  XAI_LIVE_SEARCH_TOOL_NAME,
  XAI_LIVE_SEARCH_TOOL_TYPE,
  type XAILiveSearchTool,
} from "../tools/live_search.js";

test("invoke", async () => {
  const chat = new ChatXAI({
    maxRetries: 0,
  });
  const message = new HumanMessage("What color is the sky?");
  const res = await chat.invoke([message]);
  // console.log({ res });
  expect(res.content.length).toBeGreaterThan(10);
});

test("invoke with stop sequence", async () => {
  const chat = new ChatXAI({
    maxRetries: 0,
  });
  const message = new HumanMessage("Count to ten.");
  const res = await chat.withConfig({ stop: ["5", "five"] }).invoke([message]);
  // console.log({ res });
  expect((res.content as string).toLowerCase()).not.toContain("6");
  expect((res.content as string).toLowerCase()).not.toContain("six");
});

test("stream should respect passed headers", async () => {
  const chat = new ChatXAI({
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
  const chat = new ChatXAI();
  const message = new HumanMessage("Hello!");
  const res = await chat.generate([[message]]);
  // console.log(JSON.stringify(res, null, 2));
  expect(res.generations[0][0].text.length).toBeGreaterThan(10);
});

test("streaming", async () => {
  const chat = new ChatXAI();
  const message = new HumanMessage("What color is the sky?");
  const stream = await chat.stream([message]);
  let iters = 0;
  let finalRes = "";
  for await (const chunk of stream) {
    iters += 1;
    finalRes += chunk.content;
  }
  // console.log({ finalRes, iters });
  expect(iters).toBeGreaterThan(1);
});

test("invoke with bound tools", async () => {
  const chat = new ChatXAI({
    maxRetries: 0,
    model: "grok-2-1212",
  });
  const message = new HumanMessage("What is the current weather in Hawaii?");
  const res = await chat
    .bindTools([
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
    ])
    .withConfig({ tool_choice: "auto" })
    .invoke([message]);
  // console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls?.length).toEqual(1);
  expect(
    JSON.parse(
      res.additional_kwargs?.tool_calls?.[0].function.arguments ?? "{}"
    )
  ).toEqual(res.tool_calls?.[0].args);
});

test("stream with bound tools, yielding a single chunk", async () => {
  const chat = new ChatXAI({
    maxRetries: 0,
  });
  const message = new HumanMessage("What is the current weather in Hawaii?");
  const stream = await chat
    .bindTools([
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
    ])
    .withConfig({ tool_choice: "auto" })
    .stream([message]);
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  for await (const chunk of stream) {
    // console.log(JSON.stringify(chunk));
  }
});

test("Few shotting with tool calls", async () => {
  const chat = new ChatXAI({
    model: "grok-2-1212",
    temperature: 0,
  })
    .bindTools([
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
    ])
    .withConfig({ tool_choice: "auto" });
  const res = await chat.invoke([
    new HumanMessage("What is the weather in SF?"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "12345",
          name: "get_current_weather",
          args: {
            location: "SF",
          },
        },
      ],
    }),
    new ToolMessage({
      tool_call_id: "12345",
      content: "It is currently 24 degrees with hail in SF.",
    }),
    new AIMessage("It is currently 24 degrees in SF with hail in SF."),
    new HumanMessage("What did you say the weather was?"),
  ]);
  // console.log(res);
  expect(res.content).toContain("24");
});

test("xAI can stream tool calls", async () => {
  const model = new ChatXAI({
    model: "grok-2-1212",
    temperature: 0,
  });

  const weatherTool = tool((_) => "The temperature is 24 degrees with hail.", {
    name: "get_current_weather",
    schema: z.object({
      location: z
        .string()
        .describe("The location to get the current weather for."),
    }),
    description: "Get the current weather in a given location.",
  });

  const modelWithTools = model.bindTools([weatherTool]);

  const stream = await modelWithTools.stream(
    "What is the weather in San Francisco?"
  );

  let finalMessage: AIMessageChunk | undefined;
  for await (const chunk of stream) {
    finalMessage = !finalMessage ? chunk : concat(finalMessage, chunk);
  }

  expect(finalMessage).toBeDefined();
  if (!finalMessage) return;

  expect(finalMessage.tool_calls?.[0]).toBeDefined();
  if (!finalMessage.tool_calls?.[0]) return;

  expect(finalMessage.tool_calls?.[0].name).toBe("get_current_weather");
  expect(finalMessage.tool_calls?.[0].args).toHaveProperty("location");
  expect(finalMessage.tool_calls?.[0].id).toBeDefined();
});

// Server Tool Calling (Live Search) Integration Tests
describe("Server Tool Calling (Live Search)", () => {
  test("invoke with live_search built-in tool", async () => {
    const chat = new ChatXAI({
      maxRetries: 0,
      model: "grok-2-1212",
    });

    const liveSearchTool: XAILiveSearchTool = {
      name: XAI_LIVE_SEARCH_TOOL_NAME,
      type: XAI_LIVE_SEARCH_TOOL_TYPE,
    };
    const chatWithSearch = chat.bindTools([liveSearchTool]);

    // Ask about recent events to trigger search
    const message = new HumanMessage(
      "What are the latest developments in AI as of today?"
    );
    const res = await chatWithSearch.invoke([message]);

    // The response should contain information (live search results are incorporated)
    expect(res.content).toBeDefined();
    expect((res.content as string).length).toBeGreaterThan(50);
  });

  test("invoke with searchParameters in constructor", async () => {
    const chat = new ChatXAI({
      maxRetries: 0,
      model: "grok-2-1212",
      searchParameters: {
        mode: "auto",
        max_search_results: 5,
      },
    });

    const message = new HumanMessage("What happened in the news today?");
    const res = await chat.invoke([message]);

    expect(res.content).toBeDefined();
    expect((res.content as string).length).toBeGreaterThan(50);
  });

  test("invoke with searchParameters in call options", async () => {
    const chat = new ChatXAI({
      maxRetries: 0,
      model: "grok-2-1212",
    });

    const message = new HumanMessage(
      "What is the current status of SpaceX launches?"
    );
    const res = await chat.invoke([message], {
      searchParameters: {
        mode: "on",
        max_search_results: 3,
      },
    });

    expect(res.content).toBeDefined();
    expect((res.content as string).length).toBeGreaterThan(50);
  });

  test("invoke with searchParameters sources in call options", async () => {
    const chat = new ChatXAI({
      maxRetries: 0,
      model: "grok-2-1212",
    });

    const message = new HumanMessage(
      "What are the latest updates from xAI and related news?"
    );
    const res = await chat.invoke([message], {
      searchParameters: {
        mode: "on",
        sources: [
          {
            type: "web",
            allowed_websites: ["x.ai"],
          },
          {
            type: "news",
            excluded_websites: ["bbc.co.uk"],
          },
        ],
      },
    });

    expect(res.content).toBeDefined();
    expect((res.content as string).length).toBeGreaterThan(50);
  });

  test("stream with live_search tool", async () => {
    const chat = new ChatXAI({
      maxRetries: 0,
      model: "grok-2-1212",
    });

    const liveSearchTool: XAILiveSearchTool = {
      name: XAI_LIVE_SEARCH_TOOL_NAME,
      type: XAI_LIVE_SEARCH_TOOL_TYPE,
    };
    const chatWithSearch = chat.bindTools([liveSearchTool]);

    const message = new HumanMessage("What are the top tech news stories?");
    const stream = await chatWithSearch.stream([message]);

    let finalMessage: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      finalMessage = !finalMessage ? chunk : concat(finalMessage, chunk);
    }

    expect(finalMessage).toBeDefined();
    expect(finalMessage?.content).toBeDefined();
  });

  test("combine live_search with function tools", async () => {
    const chat = new ChatXAI({
      maxRetries: 0,
      model: "grok-2-1212",
    });

    const liveSearchTool: XAILiveSearchTool = {
      type: XAI_LIVE_SEARCH_TOOL_TYPE,
      name: XAI_LIVE_SEARCH_TOOL_NAME,
    };
    const customTool = {
      type: "function" as const,
      function: {
        name: "get_stock_price",
        description: "Get the current stock price for a given symbol",
        parameters: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description: "The stock symbol, e.g. AAPL",
            },
          },
          required: ["symbol"],
        },
      },
    };

    const chatWithTools = chat.bindTools([liveSearchTool, customTool]);

    // Ask something that might trigger either tool
    const message = new HumanMessage(
      "What is Apple's current stock price and what are the latest news about the company?"
    );
    const res = await chatWithTools.invoke([message]);

    expect(res.content).toBeDefined();
    // The response might have tool calls for the custom tool
    // or might answer directly with live search data
  });
});
