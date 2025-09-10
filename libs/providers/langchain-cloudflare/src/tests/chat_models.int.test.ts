import { describe, test, expect } from "vitest";
import { ChatMessage, HumanMessage } from "@langchain/core/messages";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { ChatCloudflareWorkersAI } from "../chat_models.js";

// Save the original value of the 'LANGCHAIN_CALLBACKS_BACKGROUND' environment variable
const originalBackground = process.env.LANGCHAIN_CALLBACKS_BACKGROUND;

describe("ChatCloudflareWorkersAI", () => {
  test("call", async () => {
    const chat = new ChatCloudflareWorkersAI();
    const message = new HumanMessage("Hello!");
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await chat.call([message]);
    // console.log({ res });
  });

  test("generate", async () => {
    const chat = new ChatCloudflareWorkersAI();
    const message = new HumanMessage("Hello!");
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await chat.generate([[message]]);
    // console.log(JSON.stringify(res, null, 2));
  });

  test("generate with streaming true", async () => {
    // Running LangChain callbacks in the background will sometimes cause the callbackManager to execute
    // after the test/llm call has already finished & returned. Set that environment variable to false
    // to prevent that from happening.
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

    try {
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
    } finally {
      // Reset the environment variable
      process.env.LANGCHAIN_CALLBACKS_BACKGROUND = originalBackground;
    }
  });

  test("stream", async () => {
    const chat = new ChatCloudflareWorkersAI();
    const message = new HumanMessage("What is 2 + 2?");
    const stream = await chat.stream([message]);
    const chunks = [];
    for await (const chunk of stream) {
      // console.log(chunk.content);
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
    // console.log(chunks.map((chunk) => chunk.content).join(""));
    expect(
      chunks.map((chunk) => chunk.content).join("").length
    ).toBeGreaterThan(1);
  });

  test("custom messages", async () => {
    const chat = new ChatCloudflareWorkersAI();
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await chat.call([new ChatMessage("Hello!", "user")]);
    // console.log(JSON.stringify(res, null, 2));
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

    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const responseA = await chat.generatePrompt([
      await chatPrompt.formatPromptValue({
        job: "pirate",
        text: "What would be a good company name a company that makes colorful socks?",
      }),
    ]);

    // console.log(responseA.generations);
  });

  test("longer chain of messages", async () => {
    const chat = new ChatCloudflareWorkersAI();

    const chatPrompt = ChatPromptTemplate.fromMessages([
      HumanMessagePromptTemplate.fromTemplate(`Hi, my name is Joe!`),
      AIMessagePromptTemplate.fromTemplate(`Nice to meet you, Joe!`),
      HumanMessagePromptTemplate.fromTemplate("{text}"),
    ]);

    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const responseA = await chat.generatePrompt([
      await chatPrompt.formatPromptValue({
        text: "What did I just say my name was?",
      }),
    ]);

    // console.log(responseA.generations);
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

    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const responseA = await chat.generatePrompt([
      await chatPrompt.formatPromptValue({
        text: "What did I just say my name was?",
      }),
    ]);

    // console.log(responseA.generations);
  });
});
