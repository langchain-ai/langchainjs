import { describe, test } from "@jest/globals";
import { ChatMessage, HumanMessage } from "@langchain/core/messages";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ChatTogetherAI } from "../togetherai.js";

describe("ChatTogetherAI", () => {
  test("invoke", async () => {
    const chat = new ChatTogetherAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.invoke([message]);
    console.log({ res });
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("generate", async () => {
    const chat = new ChatTogetherAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.generate([[message]]);
    console.log(JSON.stringify(res, null, 2));
    expect(res.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("custom messages", async () => {
    const chat = new ChatTogetherAI();
    const res = await chat.invoke([new ChatMessage("Hello!", "user")]);
    console.log({ res });
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("prompt templates", async () => {
    const chat = new ChatTogetherAI();

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
    expect(responseA.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("longer chain of messages", async () => {
    const chat = new ChatTogetherAI();

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
    expect(responseA.generations[0][0].text.length).toBeGreaterThan(10);
  });
});
