import { describe, test } from "@jest/globals";
import {
  AIMessageChunk,
  ChatMessage,
  HumanMessage,
} from "@langchain/core/messages";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { ChatCloudflareWorkersAI } from "../chat_models.js";

describe("ChatCloudflareWorkersAI", () => {
  test("call", async () => {
    const chat = new ChatCloudflareWorkersAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.call([message]);
    console.log({ res });
  });

  test("generate", async () => {
    const chat = new ChatCloudflareWorkersAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.generate([[message]]);
    console.log(JSON.stringify(res, null, 2));
  });

  test("invoke", async () => {
    const chat = new ChatCloudflareWorkersAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.invoke([message]);
    expect(typeof res.content).toBe("string");
    expect(res.content.length).toBeGreaterThan(1);
    console.log(JSON.stringify(res, null, 2));
  });

  test("generate with streaming true", async () => {
    const chat = new ChatCloudflareWorkersAI({
      streaming: true,
    });
    const message = new HumanMessage("What is 2 + 2?");
    const tokens: string[] = [];
    const res = await chat.generate([[message]], {
      callbacks: [
        {
          handleLLMNewToken: (token) => {
            tokens.push(token);
          },
        },
      ],
    });
    expect(tokens.length).toBeGreaterThan(1);
    expect(tokens.join("")).toEqual(res.generations[0][0].text);
  });

  test("stream", async () => {
    const chat = new ChatCloudflareWorkersAI();
    const message = new HumanMessage("What is 2 + 2?");
    const stream = await chat.stream([message]);
    const chunks = [];
    for await (const chunk of stream) {
      console.log(chunk.content);
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
    console.log(chunks.map((chunk) => chunk.content).join(""));
    expect(
      chunks.map((chunk) => chunk.content).join("").length
    ).toBeGreaterThan(1);
  });

  test("custom messages", async () => {
    const chat = new ChatCloudflareWorkersAI();
    const res = await chat.call([new ChatMessage("Hello!", "user")]);
    console.log(JSON.stringify(res, null, 2));
  });

  test("prompt templates", async () => {
    const chat = new ChatCloudflareWorkersAI();

    // PaLM doesn't support translation yet
    const systemPrompt = PromptTemplate.fromTemplate(
      "You are a helpful assistant who must always respond like a {job}."
    );

    const chatPrompt = ChatPromptTemplate.fromMessages([
      new SystemMessagePromptTemplate(systemPrompt),
      HumanMessagePromptTemplate.fromTemplate("{text}"),
    ]);

    const responseA = await chat.generatePrompt([
      await chatPrompt.formatPromptValue({
        job: "pirate",
        text: "What would be a good company name a company that makes colorful socks?",
      }),
    ]);

    console.log(responseA.generations);
  });

  test("longer chain of messages", async () => {
    const chat = new ChatCloudflareWorkersAI();

    const chatPrompt = ChatPromptTemplate.fromMessages([
      HumanMessagePromptTemplate.fromTemplate(`Hi, my name is Joe!`),
      AIMessagePromptTemplate.fromTemplate(`Nice to meet you, Joe!`),
      HumanMessagePromptTemplate.fromTemplate("{text}"),
    ]);

    const responseA = await chat.generatePrompt([
      await chatPrompt.formatPromptValue({
        text: "What did I just say my name was?",
      }),
    ]);

    console.log(responseA.generations);
  });

  test.skip("custom base url", async () => {
    const chat = new ChatCloudflareWorkersAI({
      baseUrl: `https://gateway.ai.cloudflare.com/v1/${getEnvironmentVariable(
        "CLOUDFLARE_ACCOUNT_ID"
      )}/lang-chainjs/workers-ai/`,
    });

    const chatPrompt = ChatPromptTemplate.fromMessages([
      HumanMessagePromptTemplate.fromTemplate(`Hi, my name is Joe!`),
      AIMessagePromptTemplate.fromTemplate(`Nice to meet you, Joe!`),
      HumanMessagePromptTemplate.fromTemplate("{text}"),
    ]);

    const responseA = await chat.generatePrompt([
      await chatPrompt.formatPromptValue({
        text: "What did I just say my name was?",
      }),
    ]);

    console.log(responseA.generations);
  });

  test("Can bind and invoke tools", async () => {
    const model = new ChatCloudflareWorkersAI({
      model: "@hf/nousresearch/hermes-2-pro-mistral-7b",
    });
    const tools = [
      {
        name: "get_weather",
        description: "Get the weather",
        parameters: zodToJsonSchema(
          z.object({
            location: z
              .string()
              .describe("The location to get the weather for"),
          })
        ),
      },
    ];
    const modelWithTools = model.bindTools(tools);
    const result = await modelWithTools.invoke([
      new HumanMessage("What's the weather in San Francisco?"),
    ]);
    expect(result).toBeDefined();
    expect(result.tool_calls).toHaveLength(1);
    if (!result.tool_calls) {
      return;
    }
    expect(result.tool_calls[0].name).toBe("get_weather");
  });

  test("Can bind and stream tools", async () => {
    const model = new ChatCloudflareWorkersAI({
      model: "@hf/nousresearch/hermes-2-pro-mistral-7b",
    });
    const tools = [
      {
        name: "get_weather",
        description: "Get the weather",
        parameters: zodToJsonSchema(
          z.object({
            location: z
              .string()
              .describe("The location to get the weather for"),
          })
        ),
      },
    ];
    const modelWithTools = model.bindTools(tools);
    let finalChunk: AIMessageChunk | undefined;
    for await (const chunk of await modelWithTools.stream([
      new HumanMessage("What's the weather in San Francisco?"),
    ])) {
      // console.log("chunk: ", chunk)
      if (!finalChunk) {
        finalChunk = chunk;
      } else {
        finalChunk = finalChunk.concat(chunk);
      }
    }
    expect(finalChunk).toBeDefined();
    expect(finalChunk?.tool_calls).toHaveLength(1);
    if (!finalChunk?.tool_calls) {
      return;
    }
    expect(finalChunk.tool_calls[0].name).toBe("get_weather");
  });
});
