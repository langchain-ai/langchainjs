/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import { FirestoreChatMessageHistory } from "../message/firestore.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { ConversationChain } from "../../chains/conversation.js";
import { BufferMemory } from "../../memory/buffer_memory.js";
import { HumanMessage, AIMessage } from "../../schema/index.js";

const sessionId = Date.now().toString();

// firebase emulators:start --only firestore --project your-project-id
// FIRESTORE_EMULATOR_HOST="localhost:8080" yarn test:single -- firestore.int.test.ts

test("Test firestore message history store", async () => {
  const messageHistory = new FirestoreChatMessageHistory({
    collectionName: "langchain",
    sessionId,
    userId: "a@example.com",
    config: { projectId: "your-project-id" },
  });

  await messageHistory.addUserMessage("My name's Jonas");
  await messageHistory.addAIChatMessage("Nice to meet you, Jonas!");
  await messageHistory.addUserMessage("Nice to meet you too!");

  const expectedMessages = [
    new HumanMessage("My name's Jonas"),
    new AIMessage("Nice to meet you, Jonas!"),
    new HumanMessage("Nice to meet you too!"),
  ];

  expect(await messageHistory.getMessages()).toEqual(expectedMessages);

  const messageHistory2 = new FirestoreChatMessageHistory({
    collectionName: "langchain",
    sessionId,
    userId: "a@example.com",
    config: { projectId: "your-project-id" },
  });

  expect(await messageHistory2.getMessages()).toEqual(expectedMessages);

  await messageHistory.clear();

  expect(await messageHistory.getMessages()).toEqual([]);
});

test("Test firestore message history store in a BufferMemory", async () => {
  const memory = new BufferMemory({
    returnMessages: true,
    chatHistory: new FirestoreChatMessageHistory({
      collectionName: "langchain",
      sessionId: "BufferMemory",
      userId: "a@example.com",
      config: { projectId: "your-project-id" },
    }),
  });
  await memory.saveContext(
    { foo: "My name's Jonas" },
    { bar: "Nice to meet you, Jonas!" }
  );
  const result = await memory.loadMemoryVariables({});
  expect(result).toEqual({
    history: [
      new HumanMessage("My name's Jonas"),
      new AIMessage("Nice to meet you, Jonas!"),
    ],
  });
  await memory.clear();
  expect(await memory.loadMemoryVariables({})).toEqual({ history: [] });
});

test("Test firestore message history store in an LLM chain", async () => {
  const memory = new BufferMemory({
    chatHistory: new FirestoreChatMessageHistory({
      collectionName: "langchain",
      sessionId: "LLMChain",
      userId: "a@example.com",
      config: { projectId: "your-project-id" },
    }),
  });

  const model = new ChatOpenAI();
  const chain = new ConversationChain({ llm: model, memory });

  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log({ res1 });

  const res2 = await chain.call({ input: "What did I just say my name was?" });

  expect(res2.response.toLowerCase().includes("jim")).toEqual(true);
});
