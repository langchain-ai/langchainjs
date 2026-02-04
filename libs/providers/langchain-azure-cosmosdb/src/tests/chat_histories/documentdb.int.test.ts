import { test, expect, afterAll } from "vitest";
import { MongoClient, ObjectId } from "mongodb";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  AzureDocumentDBChatMessageHistory,
  AzureDocumentDBChatHistoryDBConfig,
} from "../../chat_histories/documentdb.js";

afterAll(async () => {
  const connectionString =
    process.env.AZURE_DOCUMENTDB_CONNECTION_STRING ||
    process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING;
  const client = new MongoClient(connectionString!);
  await client.connect();
  await client.db("langchain").dropDatabase();
  await client.close();
});

test("Test Azure DocumentDB history store", async () => {
  const connectionString =
    process.env.AZURE_DOCUMENTDB_CONNECTION_STRING ||
    process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING;
  expect(connectionString).toBeDefined();

  const mongoClient = new MongoClient(connectionString!);
  const dbcfg: AzureDocumentDBChatHistoryDBConfig = {
    client: mongoClient,
    connectionString,
    databaseName: "langchain",
    collectionName: "chathistory",
  };

  const sessionId = new ObjectId().toString();
  const userId = new ObjectId().toString();
  const chatHistory = new AzureDocumentDBChatMessageHistory(
    dbcfg,
    sessionId,
    userId
  );

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await chatHistory.addMessages([
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ]);

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await mongoClient.close();
});

test("Test clear Azure DocumentDB history store", async () => {
  const connectionString =
    process.env.AZURE_DOCUMENTDB_CONNECTION_STRING ||
    process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING;
  expect(connectionString).toBeDefined();

  const mongoClient = new MongoClient(connectionString!);
  const dbcfg: AzureDocumentDBChatHistoryDBConfig = {
    client: mongoClient,
    connectionString,
    databaseName: "langchain",
    collectionName: "chathistory",
  };

  const sessionId = new ObjectId().toString();
  const userId = new ObjectId().toString();
  const chatHistory = new AzureDocumentDBChatMessageHistory(
    dbcfg,
    sessionId,
    userId
  );

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

  await mongoClient.close();
});

test("Test getAllSessions and clearAllSessions", async () => {
  const connectionString =
    process.env.AZURE_DOCUMENTDB_CONNECTION_STRING ||
    process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING;
  expect(connectionString).toBeDefined();

  const mongoClient = new MongoClient(connectionString!);
  const dbcfg: AzureDocumentDBChatHistoryDBConfig = {
    client: mongoClient,
    connectionString,
    databaseName: "langchain",
    collectionName: "chathistory",
  };

  const sessionId1 = new ObjectId().toString();
  const userId = new ObjectId().toString();
  const sessionId2 = new ObjectId().toString();

  const chatHistory1 = new AzureDocumentDBChatMessageHistory(
    dbcfg,
    sessionId1,
    userId
  );
  const chatHistory2 = new AzureDocumentDBChatMessageHistory(
    dbcfg,
    sessionId2,
    userId
  );

  // Clear any existing sessions from previous test runs
  await chatHistory1.clearAllSessions();

  await chatHistory1.addUserMessage("What is AI?");
  await chatHistory1.addAIMessage("AI stands for Artificial Intelligence.");
  await chatHistory2.addUserMessage("What is the best programming language?");
  await chatHistory2.addAIMessage("It depends on the use case.");

  const allSessions = await chatHistory1.getAllSessions();
  expect(allSessions.length).toBe(2);
  expect(allSessions[0].id).toBe(sessionId1);
  expect(allSessions[1].id).toBe(sessionId2);

  await chatHistory1.clearAllSessions();
  const clearedSessions = await chatHistory1.getAllSessions();
  expect(clearedSessions.length).toBe(0);

  await mongoClient.close();
});
