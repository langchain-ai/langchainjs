import { describe, test } from "@jest/globals";
import { ChatMessage, HumanMessage } from "@langchain/core/messages";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ChatNovitaAI } from "../novita.js";

describe("ChatNovitaAI", () => {
  test("invoke", async () => {
    const chat = new ChatNovitaAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.invoke([message]);
    expect(res.content.length).toBeGreaterThan(10);
  });

  test("generate", async () => {
    const chat = new ChatNovitaAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.generate([[message]]);
    expect(res.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("custom messages", async () => {
    const chat = new ChatNovitaAI();
    const res = await chat.invoke([new ChatMessage("Hello!", "user")]);
    expect(res.content.length).toBeGreaterThan(2);
  });

  test("chaining", async () => {
    const chat = new ChatNovitaAI();
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are a helpful assistant that translates {input_language} to {output_language}.",
      ],
      ["human", "{input}"],
    ]);

    const chain = prompt.pipe(chat);
    const response = await chain.invoke({
      input_language: "English",
      output_language: "German",
      input: "I love programming.",
    });

    expect(response.content.length).toBeGreaterThan(10);
  });

  test("prompt templates", async () => {
    const chat = new ChatNovitaAI();

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
    expect(responseA.generations[0][0].text.length).toBeGreaterThan(10);
  });

  test("longer chain of messages", async () => {
    const chat = new ChatNovitaAI();

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
    expect(responseA.generations[0][0].text.length).toBeGreaterThan(10);
  });
});
