import { test, expect, beforeAll, beforeEach, afterAll } from "vitest";
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

beforeEach(async () => {
  await collection.deleteMany({});
});

afterAll(async () => {
  await client.close();
});

test("nothing is inserted into the database until messages are added", async () => {
  const sessionId = new ObjectId().toString();
  // we explicitly test that there are no side effects
  new MongoDBChatMessageHistory({
    collection,
    sessionId,
  });
  expect(await collection.findOne({ sessionId })).toBeNull();
});

test("addMessage() upserts if the document does not exist", async () => {
  const sessionId = new ObjectId().toString();
  const chatHistory = new MongoDBChatMessageHistory({
    collection,
    sessionId,
  });

  expect((await collection.find().toArray()).length).toBe(0);

  const message = new HumanMessage("Who is the best vocalist?");
  await chatHistory.addMessage(message);

  const [
    {
      messages: [
        {
          data: { content },
        },
      ],
    },
  ] = await collection.find().toArray();

  expect(content).toEqual("Who is the best vocalist?");
});

test("addMessage() appends to the document if it exists", async () => {
  const sessionId = new ObjectId().toString();
  const chatHistory = new MongoDBChatMessageHistory({
    collection,
    sessionId,
  });
  expect((await collection.find().toArray()).length).toBe(0);

  const message = new HumanMessage("Who is the best vocalist?");
  await chatHistory.addMessage(message);
  const message2 = new AIMessage("Ozzy Osbourne");
  await chatHistory.addMessage(message2);
  const [
    {
      messages: [
        {
          data: { content },
        },
        {
          data: { content: content2 },
        },
      ],
    },
  ] = await collection.find().toArray();

  expect(content).toEqual("Who is the best vocalist?");
  expect(content2).toEqual("Ozzy Osbourne");
});

test("clear() removes all messages for a given sessionId", async () => {
  const sessionId = new ObjectId().toString();
  const chatHistory = new MongoDBChatMessageHistory({
    collection,
    sessionId,
  });
  const message = new HumanMessage("Who is the best vocalist?");
  await chatHistory.addMessage(message);
  expect((await collection.find().toArray()).length).toBe(1);
  await chatHistory.clear();
  expect((await collection.find().toArray()).length).toBe(0);
});

test("clear() only removes messages for the given sessionId", async () => {
  const sessionId1 = new ObjectId().toString();
  const sessionId2 = new ObjectId().toString();
  const chatHistory1 = new MongoDBChatMessageHistory({
    collection,
    sessionId: sessionId1,
  });
  const chatHistory2 = new MongoDBChatMessageHistory({
    collection,
    sessionId: sessionId2,
  });
  const message1 = new HumanMessage("Who is the best vocalist?");
  await chatHistory1.addMessage(message1);
  await chatHistory2.addMessage(message1);

  expect((await collection.find().toArray()).length).toBe(2);
  await chatHistory1.clear();

  expect(await collection.findOne({ sessionId: sessionId1 })).toBeNull();
  expect(await collection.findOne({ sessionId: sessionId2 })).not.toBeNull();
});

test("getMessages() returns [] if no messages exist", async () => {
  const sessionId = new ObjectId().toString();

  const chatHistory = new MongoDBChatMessageHistory({
    collection,
    sessionId,
  });
  expect(await chatHistory.getMessages()).toStrictEqual([]);
});

test("getMessages() messages when messages exist", async () => {
  const sessionId = new ObjectId().toString();
  const chatHistory = new MongoDBChatMessageHistory({
    collection,
    sessionId,
  });
  await chatHistory.addMessage(new HumanMessage("Who is the best vocalist?"));
  expect(await chatHistory.getMessages()).toStrictEqual([
    new HumanMessage("Who is the best vocalist?"),
  ]);
});

test("getMessages() returns messages in the order they were added", async () => {
  const sessionId = new ObjectId().toString();
  const chatHistory = new MongoDBChatMessageHistory({
    collection,
    sessionId,
  });

  await chatHistory.addMessage(new HumanMessage("Who is the best vocalist?"));
  await chatHistory.addMessage(new AIMessage("Ozzy Osbourne"));
  await chatHistory.addMessage(new HumanMessage("Who is the best guitarist?"));
  await chatHistory.addMessage(new AIMessage("Jimmy Page"));

  expect(await chatHistory.getMessages()).toStrictEqual([
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
    new HumanMessage("Who is the best guitarist?"),
    new AIMessage("Jimmy Page"),
  ]);
});

test("GHSA-m6rx-h84q-8r95: $eq filters block cross-session access even if the sessionId check is bypassed", async () => {
  const victimSessionId = `victim-${new ObjectId().toString()}`;
  const victimHistory = new MongoDBChatMessageHistory({
    collection,
    sessionId: victimSessionId,
  });
  await victimHistory.addMessage(new HumanMessage("victim's secret message"));

  const attackerHistory = new MongoDBChatMessageHistory({
    collection,
    sessionId: "placeholder",
  });
  (attackerHistory as unknown as { sessionId: unknown }).sessionId = {
    $regex: "^victim-",
  };

  expect(await attackerHistory.getMessages()).toStrictEqual([]);

  await attackerHistory.addMessage(new AIMessage("attacker-injected message"));
  await attackerHistory.clear();

  expect(await victimHistory.getMessages()).toStrictEqual([
    new HumanMessage("victim's secret message"),
  ]);
});
