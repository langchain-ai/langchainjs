import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "../openai.js";
import { HumanChatMessage, SystemChatMessage } from "../../schema/index.js";
import { ChatPromptValue } from "../../prompts/chat.js";
import {
  PromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { LLMChain } from "../../chains/index.js";

test("Test ChatOpenAI", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatOpenAI with SystemChatMessage", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const system_message = new SystemChatMessage("You are to chat with a user.");
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([system_message, message]);
  console.log({ res });
});

test("Test ChatOpenAI Generate", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.generate([[message], [message]]);
  expect(res.generations.length).toBe(2);
  for (const generation of res.generations) {
    expect(generation.length).toBe(2);
    for (const message of generation) {
      console.log(message.text);
    }
  }
  console.log({ res });
});

test("Test ChatOpenAI in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: true,
    callbackManager: {
      handleNewToken(token) {
        nrNewTokens += 1;
        streamedCompletion += token;
      },
    },
  });
  const message = new HumanChatMessage("Hello!");
  const res = await model.call([message]);
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res.text).toBe(streamedCompletion);
});

test("Test ChatOpenAI prompt value", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.generatePrompt([new ChatPromptValue([message])]);
  expect(res.generations.length).toBe(1);
  for (const generation of res.generations) {
    expect(generation.length).toBe(2);
    for (const g of generation) {
      console.log(g.text);
    }
  }
  console.log({ res });
});

test("OpenAI Chat, docs, getting started", async () => {
  const chat = new ChatOpenAI({ temperature: 0 });

  const responseA = await chat.call([
    new HumanChatMessage(
      "Translate this sentence from English to French. I love programming."
    ),
  ]);

  console.log(responseA);

  const responseB = await chat.call([
    new SystemChatMessage(
      "You are a helpful assistant that translates English to French."
    ),
    new HumanChatMessage(
      "Translate this sentence from English to French. I love programming."
    ),
  ]);

  console.log(responseB);

  const responseC = await chat.generate([
    [
      new SystemChatMessage(
        "You are a helpful assistant that translates English to French."
      ),
      new HumanChatMessage(
        "Translate this sentence from English to French. I love programming."
      ),
    ],
    [
      new SystemChatMessage(
        "You are a helpful assistant that translates English to French."
      ),
      new HumanChatMessage(
        "Translate this sentence from English to French. I love artificial intelligence."
      ),
    ],
  ]);

  console.log(responseC);
});

test("OpenAI Chat, docs, prompt templates", async () => {
  const chat = new ChatOpenAI({ temperature: 0 });

  const systemPrompt = PromptTemplate.fromTemplate(
    "You are a helpful assistant that translates {input_language} to {output_language}."
  );

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  const responseA = await chat.generatePrompt([
    await chatPrompt.formatPromptValue({
      input_language: "English",
      output_language: "French",
      text: "I love programming.",
    }),
  ]);

  console.log(responseA.generations);

  const chain = new LLMChain({
    prompt: chatPrompt,
    llm: chat,
  });

  const responseB = await chain.call({
    input_language: "English",
    output_language: "French",
    text: "I love programming.",
  });

  console.log(responseB);
});
