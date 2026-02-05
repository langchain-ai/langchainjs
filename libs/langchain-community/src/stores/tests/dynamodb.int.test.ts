import { test, expect, beforeEach, afterEach } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { DynamoDBChatMessageHistory } from "../message/dynamodb.js";

describe("DynamoDB message history store", () => {
  let messageHistory: DynamoDBChatMessageHistory;
  let message1: HumanMessage;
  let message2: AIMessage;
  let noKwargsMessage3: HumanMessage;
  const sessionId = new Date().toISOString();

  beforeEach(() => {
    messageHistory = new DynamoDBChatMessageHistory({
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

    message1 = new HumanMessage({
      content: "Hi I am Michael",
      additional_kwargs: {
        someArg: "Love is love",
        createdAt: new Date().toISOString(),
      },
    });

    message2 = new AIMessage({
      content: "Nice to meet you, Michael!",
      additional_kwargs: {
        someArg: "Langchain is awesome",
        createdAt: new Date().toISOString(),
      },
    });

    noKwargsMessage3 = new HumanMessage({
      content: "Nice to meet you too!",
    });
  });

  afterEach(async () => {
    await messageHistory.clear();
  });

  test("should add and retrieve messages", async () => {
    await messageHistory.addMessage(message1);
    await messageHistory.addMessage(message2);
    await messageHistory.addMessage(noKwargsMessage3);

    const expectedMessages = [message1, message2, noKwargsMessage3];

    expect(await messageHistory.getMessages()).toEqual(expectedMessages);
  });

  test("should retrieve messages from a new instance", async () => {
    await messageHistory.addMessage(message1);
    await messageHistory.addMessage(message2);
    await messageHistory.addMessage(noKwargsMessage3);

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

    const expectedMessages = [message1, message2, noKwargsMessage3];

    expect(await messageHistory2.getMessages()).toEqual(expectedMessages);
  });

  test("should clear messages", async () => {
    expect(await messageHistory.getMessages()).toEqual([]);
  });

  test("should add multiple messages", async () => {
    const expectedMessages = [message1, message2, noKwargsMessage3];

    await messageHistory.addMessages(expectedMessages);

    expect(await messageHistory.getMessages()).toEqual(expectedMessages);
  });
});
