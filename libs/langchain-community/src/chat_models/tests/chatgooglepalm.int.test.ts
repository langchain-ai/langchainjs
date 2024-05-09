import { test } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  PromptTemplate,
  ChatPromptTemplate,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ChatGooglePaLM } from "../googlepalm.js";

test.skip("Test ChatGooglePalm", async () => {
  const chat = new ChatGooglePaLM({
    maxRetries: 1,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.invoke([message]);
  console.log({ res });
});

test.skip("Test ChatGooglePalm generate", async () => {
  const chat = new ChatGooglePaLM({
    maxRetries: 1,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generate([[message]]);
  console.log(JSON.stringify(res, null, 2));
});

test.skip("ChatGooglePalm, prompt templates", async () => {
  const chat = new ChatGooglePaLM({
    maxRetries: 1,
    examples: [
      {
        input: new HumanMessage("What is your favorite sock color?"),
        output: new AIMessage("My favorite sock color be arrrr-ange!"),
      },
    ],
  });

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

test.skip("ChatGooglePalm, longer chain of messages", async () => {
  const chat = new ChatGooglePaLM({
    maxRetries: 1,
  });

  const chatPrompt = ChatPromptTemplate.fromMessages([
    AIMessagePromptTemplate.fromTemplate(
      `Hello there! I'm Droid, your personal assistant.`
    ),
    HumanMessagePromptTemplate.fromTemplate(`Hi, my name is Joe!`),
    AIMessagePromptTemplate.fromTemplate(
      `Nice to meet you, Joe! How can I help you today?`
    ),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  const responseA = await chat.generatePrompt([
    await chatPrompt.formatPromptValue({
      text: "What did I just say my name was?",
    }),
  ]);

  console.log(responseA.generations);
});

test.skip("ChatGooglePalm, chain of messages on code", async () => {
  const chat = new ChatGooglePaLM({
    maxRetries: 1,
  });

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
