/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { DynamoDBChatMessageHistory } from "../message/dynamodb.js";

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
    new HumanMessage("My name's Jonas"),
    new AIMessage("Nice to meet you, Jonas!"),
    new HumanMessage("Nice to meet you too!"),
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
