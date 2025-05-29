/* eslint-disable no-process-env */

import { Collection, MongoClient, ObjectId } from "mongodb";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { MongoDBChatMessageHistory } from "../chat_history.js";
import { uri } from "./utils.js";

let client: MongoClient;
let collection: Collection;

beforeAll(async () => {
  client = new MongoClient(uri());
  await client.connect();
  collection = await client.db("langchain_test").createCollection("memory");
});

afterAll(async () => {
  await client.close();
});

test("Test MongoDB history store", async () => {
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
});

test("Test clear MongoDB history store", async () => {
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
});
