/*  eslint-disable no-promise-executor-return  */
/* eslint-disable no-process-env */

import { expect } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { ObjectId } from "mongodb";
import { AzureCosmsosDBNoSQLChatMessageHistory } from "../chat_histories.js";

const DATABASE_NAME = "langchainTestDB";
const CONTAINER_NAME = "testContainer";

/*
 * To run this test, you need have an Azure Cosmos DB for NoSQL instance
 * running. You can deploy a free version on Azure Portal without any cost,
 * following this guide:
 * https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
 *
 * You do not need to create a database or collection, it will be created
 * automatically by the test.
 *
 * Once you have the instance running, you need to set the following environment
 * variables before running the test:
 * - AZURE_COSMOSDB_NOSQL_CONNECTION_STRING or AZURE_COSMOSDB_NOSQL_ENDPOINT
 */
beforeEach(async () => {
  let client: CosmosClient;

  if (process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING) {
    client = new CosmosClient(
      process.env.AZURE_COSMOSDB_NOSQL_CONNECTION_STRING
    );
  } else if (process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT) {
    client = new CosmosClient({
      endpoint: process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT,
      aadCredentials: new DefaultAzureCredential(),
    });
  } else {
    throw new Error(
      "Please set the environment variable AZURE_COSMOSDB_NOSQL_CONNECTION_STRING or AZURE_COSMOSDB_NOSQL_ENDPOINT"
    );
  }
  try {
    await client.database(DATABASE_NAME).delete();
  } catch {
    // Ignore error if the database does not exist
  }
  try {
    await client.database("DbWithTTL").delete();
  } catch {
    // Ignore error if the database does not exist
  }
});

test("Test CosmosDB History Store", async () => {
  const input = {
    sessionId: new ObjectId().toString(),
    userId: new ObjectId().toString(),
    databaseName: DATABASE_NAME,
    containerName: CONTAINER_NAME,
  };
  const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory(input);
  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];
  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);
});

test("Test clear CosmosDB history Store", async () => {
  const input = {
    sessionId: new ObjectId().toString(),
    userId: new ObjectId().toString(),
    databaseName: DATABASE_NAME,
    containerName: CONTAINER_NAME,
  };
  const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory(input);

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];
  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await chatHistory.clear();

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);
});

test("Test CosmosDB history with a TTL", async () => {
  const input = {
    sessionId: new ObjectId().toString(),
    userId: new ObjectId().toString(),
    databaseName: "DbWithTTL",
    ttl: 5,
  };
  const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory(input);

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];
  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await new Promise((resolve) => setTimeout(resolve, 6000));

  const expiredResult = await chatHistory.getMessages();
  expect(expiredResult).toStrictEqual([]);
});

test("Test clear all sessions for a user", async () => {
  const input1 = {
    sessionId: new Date().toISOString(),
    userId: "user1",
    databaseName: "DbWithTTL",
    ttl: 5,
  };
  const chatHistory1 = new AzureCosmsosDBNoSQLChatMessageHistory(input1);

  await chatHistory1.addUserMessage("Who is the best vocalist?");
  await chatHistory1.addAIMessage("Ozzy Osbourne");

  const input2 = {
    sessionId: new Date().toISOString(),
    userId: "user1",
    databaseName: "DbWithTTL",
    ttl: 5,
  };
  const chatHistory2 = new AzureCosmsosDBNoSQLChatMessageHistory(input2);

  await chatHistory2.addUserMessage("Who is the best vocalist?");
  await chatHistory2.addAIMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];

  const result1 = await chatHistory1.getMessages();
  expect(result1).toEqual(expectedMessages);

  const result2 = await chatHistory1.getMessages();
  expect(result2).toEqual(expectedMessages);

  await chatHistory1.clearAllSessionsForUser("user1");

  const deletedResult1 = await chatHistory1.getMessages();
  const deletedResult2 = await chatHistory2.getMessages();
  expect(deletedResult1).toStrictEqual([]);
  expect(deletedResult2).toStrictEqual([]);
});
