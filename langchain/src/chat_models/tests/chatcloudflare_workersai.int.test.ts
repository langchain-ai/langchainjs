import { describe, test } from "@jest/globals";
import { ChatMessage, HumanMessage } from "../../schema/index.js";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { ChatCloudflareWorkersAI } from "../cloudflare_workersai.js";
import { getEnvironmentVariable } from "../../util/env.js";

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
});
