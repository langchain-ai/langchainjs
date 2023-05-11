/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import { DynamoDBChatMessageHistory } from "../message/dynamodb.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { ConversationChain } from "../../chains/conversation.js";
import { BufferMemory } from "../../memory/buffer_memory.js";
import { HumanChatMessage, AIChatMessage } from "../../schema/index.js";

test("Test DynamoDB message history store", async () => {
  const sessionId = new Date().toISOString();
  const messageHistory = new DynamoDBChatMessageHistory({
    tableName: "langchain",
    sessionId,
    config: {
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    },
  });

  await messageHistory.addUserMessage("My name's Jonas");
  await messageHistory.addAIChatMessage("Nice to meet you, Jonas!");
  await messageHistory.addUserMessage("Nice to meet you too!");

  const expectedMessages = [
    new HumanChatMessage("My name's Jonas"),
    new AIChatMessage("Nice to meet you, Jonas!"),
    new HumanChatMessage("Nice to meet you too!"),
  ];

  expect(await messageHistory.getMessages()).toEqual(expectedMessages);

  const messageHistory2 = new DynamoDBChatMessageHistory({
    tableName: "langchain",
    sessionId,
    config: {
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    },
  });

  expect(await messageHistory2.getMessages()).toEqual(expectedMessages);

  await messageHistory.clear();

  expect(await messageHistory.getMessages()).toEqual([]);
});

test("Test DynamoDB message history store in a BufferMemory", async () => {
  const memory = new BufferMemory({
    returnMessages: true,
    chatHistory: new DynamoDBChatMessageHistory({
      tableName: "langchain",
      sessionId: new Date().toISOString(),
      config: {
        region: process.env.AWS_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      },
    }),
  });
  await memory.saveContext(
    { foo: "My name's Jonas" },
    { bar: "Nice to meet you, Jonas!" }
  );
  const result = await memory.loadMemoryVariables({});
  expect(result).toStrictEqual({
    history: [
      new HumanChatMessage("My name's Jonas"),
      new AIChatMessage("Nice to meet you, Jonas!"),
    ],
  });
});

test("Test DynamoDB message history store in an LLM chain", async () => {
  const memory = new BufferMemory({
    chatHistory: new DynamoDBChatMessageHistory({
      tableName: "langchain",
      sessionId: new Date().toISOString(),
      config: {
        region: process.env.AWS_REGION!,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      },
    }),
  });

  const model = new ChatOpenAI();
  const chain = new ConversationChain({ llm: model, memory });

  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log({ res1 });

  const res2 = await chain.call({ input: "What did I just say my name was?" });
  console.log({ res2 });
});
