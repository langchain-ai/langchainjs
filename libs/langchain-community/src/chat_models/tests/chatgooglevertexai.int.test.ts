import { describe, expect, test } from "@jest/globals";
import { ChatMessage, HumanMessage } from "@langchain/core/messages";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ChatGoogleVertexAI } from "../googlevertexai/index.js";

describe("ChatGoogleVertexAI", () => {
  test("call", async () => {
    const chat = new ChatGoogleVertexAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.invoke([message]);
    console.log({ res });
  });

  test("32k", async () => {
    const chat = new ChatGoogleVertexAI({
      model: "chat-bison-32k",
    });
    const message = new HumanMessage("Hello!");
    const res = await chat.invoke([message]);
    console.log({ res });
  });

  test("generate", async () => {
    const chat = new ChatGoogleVertexAI();
    const message = new HumanMessage("Hello!");
    const res = await chat.generate([[message]]);
    console.log(JSON.stringify(res, null, 2));
  });

  test("custom messages", async () => {
    const chat = new ChatGoogleVertexAI();
    const res = await chat.invoke([new ChatMessage("Hello!", "user")]);
    console.log(JSON.stringify(res, null, 2));
  });

  test("prompt templates", async () => {
    const chat = new ChatGoogleVertexAI();

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
    const chat = new ChatGoogleVertexAI();

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

  test("code, chain of messages", async () => {
    const chat = new ChatGoogleVertexAI({ model: "codechat-bison" });

    const chatPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `Answer all questions using Python and just show the code without an explanation.`
      ),
      HumanMessagePromptTemplate.fromTemplate("{text}"),
    ]);

    const responseA = await chat.generatePrompt([
      await chatPrompt.formatPromptValue({
        text: "How can I write a for loop counting to 10?",
      }),
    ]);

    console.log(JSON.stringify(responseA.generations, null, 1));
  });

  test("stream method", async () => {
    const model = new ChatGoogleVertexAI();
    const stream = await model.stream(
      "What is the answer to life, the universe, and everything? Be verbose."
    );
    const chunks = [];
    for await (const chunk of stream) {
      console.log("chunk", chunk);
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });
});
