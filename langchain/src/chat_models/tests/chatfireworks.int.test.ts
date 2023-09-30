import { describe, test } from "@jest/globals";
import { ChatMessage, HumanMessage } from "../../schema/index.js";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { ChatFireworks } from "../fireworks.js";

describe("ChatFireworks", () => {
  test("call", async () => {
    const chat = new ChatFireworks();
    const message = new HumanMessage("Hello!");
    const res = await chat.call([message]);
    console.log({ res });
  });

  test("generate", async () => {
    const chat = new ChatFireworks();
    const message = new HumanMessage("Hello!");
    const res = await chat.generate([[message]]);
    console.log(JSON.stringify(res, null, 2));
  });

  test("custom messages", async () => {
    const chat = new ChatFireworks();
    const res = await chat.call([new ChatMessage("Hello!", "user")]);
    console.log(JSON.stringify(res, null, 2));
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

    const responseA = await chat.generatePrompt([
      await chatPrompt.formatPromptValue({
        job: "pirate",
        text: "What would be a good company name a company that makes colorful socks?",
      }),
    ]);

    console.log(responseA.generations);
  });

  test("longer chain of messages", async () => {
    const chat = new ChatFireworks();

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
