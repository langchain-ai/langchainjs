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

  const message1 = new HumanMessage({
    content: "Hi I am Michael",
    additional_kwargs: {
      someArg: "Love is love",
      createdAt: new Date().toISOString(),
    },
  });

  const message2 = new AIMessage({
    content: "Nice to meet you, Michael!",
    additional_kwargs: {
      someArg: "Langchain is awesome",
      createdAt: new Date().toISOString(),
    },
  });

  const noKwargsMessage3 = new HumanMessage({
    content: "Nice to meet you too!",
  });

  await messageHistory.addMessage(message1);
  await messageHistory.addMessage(message2);
  await messageHistory.addMessage(noKwargsMessage3);

  const expectedMessages = [message1, message2, noKwargsMessage3];

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

  // await messageHistory.clear();

  // expect(await messageHistory.getMessages()).toEqual([]);
});
