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
  const chatHistory = new AzureCosmosDBMongoChatMessageHistory(
    dbcfg,
    sessionId
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
  const chatHistory = new AzureCosmosDBMongoChatMessageHistory(
    dbcfg,
    sessionId
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
