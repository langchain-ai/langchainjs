/* eslint-disable no-process-env */

import { MongoClient, ObjectId } from "mongodb";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  AzureCosmosDBMongoChatMessageHistory,
  AzureCosmosDBMongoChatHistoryDBConfig,
} from "../../chat_histories/mongodb.js";

afterAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(
    process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING!
  );
  await client.connect();
  await client.db("langchain").dropDatabase();
  await client.close();
});

test("Test Azure Cosmos MongoDB history store", async () => {
  expect(process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const mongoClient = new MongoClient(
    process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING!
  );
  const dbcfg: AzureCosmosDBMongoChatHistoryDBConfig = {
    client: mongoClient,
    connectionString: process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING,
    databaseName: "langchain",
    collectionName: "chathistory",
  };

  const sessionId = new ObjectId().toString();
  const userId = new ObjectId().toString();
  const chatHistory = new AzureCosmosDBMongoChatMessageHistory(
    dbcfg,
    sessionId,
    userId
  );

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await chatHistory.getMessages();
  console.log(resultWithHistory);
  expect(resultWithHistory).toEqual(expectedMessages);

  await mongoClient.close();
});

test("Test clear Azure Cosmos MongoDB history store", async () => {
  expect(process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const mongoClient = new MongoClient(
    process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING!
  );
  const dbcfg: AzureCosmosDBMongoChatHistoryDBConfig = {
    client: mongoClient,
    connectionString: process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING,
    databaseName: "langchain",
    collectionName: "chathistory",
  };

  const sessionId = new ObjectId().toString();
  const userId = new ObjectId().toString();
  const chatHistory = new AzureCosmosDBMongoChatMessageHistory(
    dbcfg,
    sessionId,
    userId
  );

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await chatHistory.clear();

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await mongoClient.close();
});

test("Test getAllSessions and clearAllSessions", async () => {
  expect(process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const mongoClient = new MongoClient(
    process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING!
  );
  const dbcfg: AzureCosmosDBMongoChatHistoryDBConfig = {
    client: mongoClient,
    connectionString: process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING,
    databaseName: "langchain",
    collectionName: "chathistory",
  };

  const sessionId1 = new ObjectId().toString();
  const userId1 = new ObjectId().toString();
  const sessionId2 = new ObjectId().toString();
  const userId2 = new ObjectId().toString();

  const chatHistory1 = new AzureCosmosDBMongoChatMessageHistory(
    dbcfg,
    sessionId1,
    userId1
  );
  const chatHistory2 = new AzureCosmosDBMongoChatMessageHistory(
    dbcfg,
    sessionId2,
    userId2
  );

  await chatHistory1.addUserMessage("What is AI?");
  await chatHistory1.addAIChatMessage("AI stands for Artificial Intelligence.");
  await chatHistory2.addUserMessage("What is the best programming language?");
  await chatHistory2.addAIChatMessage("It depends on the use case.");

  const allSessions = await chatHistory1.getAllSessions();
  expect(allSessions.length).toBe(2);
  expect(allSessions[0].id).toBe(sessionId1);
  expect(allSessions[1].id).toBe(sessionId2);

  await chatHistory1.clearAllSessions();
  const clearedSessions = await chatHistory1.getAllSessions();
  expect(clearedSessions.length).toBe(0);

  await mongoClient.close();
});
