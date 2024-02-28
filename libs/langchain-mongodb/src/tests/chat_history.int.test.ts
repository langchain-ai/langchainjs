/* eslint-disable no-process-env */

import { MongoClient, ObjectId } from "mongodb";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { MongoDBChatMessageHistory } from "../chat_history.js";

afterAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!);
  await client.connect();
  await client.db("langchain").dropDatabase();
  await client.close();
});

test("Test MongoDB history store", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!);
  await client.connect();
  const collection = client.db("langchain").collection("memory");

  const sessionId = new ObjectId().toString();
  const chatHistory = new MongoDBChatMessageHistory({
    collection,
    sessionId,
  });

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await client.close();
});

test("Test clear MongoDB history store", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!);
  await client.connect();
  const collection = client.db("langchain").collection("memory");

  const sessionId = new ObjectId().toString();
  const chatHistory = new MongoDBChatMessageHistory({
    collection,
    sessionId,
  });

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

  await client.close();
});
