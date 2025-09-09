import { z } from "zod";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { describe, test } from "@jest/globals";
import { ChatMessage, HumanMessage } from "@langchain/core/messages";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ChatFireworks } from "../fireworks.js";

describe.skip("ChatFireworks", () => {
  test("call", async () => {
    const chat = new ChatFireworks();
    const message = new HumanMessage("Hello!");
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await chat.invoke([message]);
    // console.log({ res });
  });

  test("generate", async () => {
    const chat = new ChatFireworks();
    const message = new HumanMessage("Hello!");
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await chat.generate([[message]]);
    // console.log(JSON.stringify(res, null, 2));
  });

  test("custom messages", async () => {
    const chat = new ChatFireworks();
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const res = await chat.invoke([new ChatMessage("Hello!", "user")]);
    // console.log(JSON.stringify(res, null, 2));
  });

  test("prompt templates", async () => {
    const chat = new ChatFireworks();

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
    const chat = new ChatFireworks();

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

  test("Tool calling", async () => {
    const zodSchema = z
      .object({
        location: z
          .string()
          .describe("The name of city to get the weather for."),
      })
      .describe(
        "Get the weather of a specific location and return the temperature in Celsius."
      );
    const chat = new ChatFireworks({
      modelName: "accounts/fireworks/models/firefunction-v1",
      temperature: 0,
    }).bindTools([
      {
        type: "function",
        function: {
          name: "get_current_weather",
          description: "Get the current weather in a given location",
          parameters: toJsonSchema(zodSchema),
        },
      },
    ]);
    // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
    // @ts-expect-error unused var
    const result = await chat.invoke("What is the current weather in SF?");
    // console.log(result);
  });
});
