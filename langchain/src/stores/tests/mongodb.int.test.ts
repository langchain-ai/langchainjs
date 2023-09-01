/* eslint-disable no-process-env */

import { MongoClient, ObjectId } from "mongodb";
import { MongoDBChatMessageHistory } from "../message/mongodb.js";
import { AIMessage, HumanMessage } from "../../schema/index.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { ConversationChain } from "../../chains/conversation.js";
import { BufferMemory } from "../../memory/buffer_memory.js";

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

test("Test MongoDB memory with Buffer Memory", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!);
  await client.connect();
  const collection = client.db("langchain").collection("memory");
  const sessionId = new ObjectId().toString();
  const memory = new BufferMemory({
    returnMessages: true,
    chatHistory: new MongoDBChatMessageHistory({
      collection,
      sessionId,
    }),
  });

  await memory.saveContext(
    { input: "Who is the best vocalist?" },
    { response: "Ozzy Osbourne" }
  );

  const expectedHistory = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];

  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedHistory });

  await client.close();
});

test("Test MongoDB memory with LLM Chain", async () => {
  expect(process.env.MONGODB_ATLAS_URI).toBeDefined();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI!);
  await client.connect();
  const collection = client.db("langchain").collection("memory");
  const sessionId = new ObjectId().toString();
  const memory = new BufferMemory({
    chatHistory: new MongoDBChatMessageHistory({
      collection,
      sessionId,
    }),
  });

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0,
  });
  const chain = new ConversationChain({ llm: model, memory });

  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log({ res1 });

  const res2 = await chain.call({ input: "What did I just say my name was?" });
  console.log({ res2 });

  await client.close();
});
