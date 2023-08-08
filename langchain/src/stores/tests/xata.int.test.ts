/* eslint-disable no-process-env */
// eslint-disable-next-line import/no-extraneous-dependencies
import { BaseClient } from "@xata.io/client";
import { AIMessage, HumanMessage } from "../../schema/index.js";
import { BufferMemory } from "../../memory/buffer_memory.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { ConversationChain } from "../../chains/conversation.js";
import { XataChatMessageHistory } from "../message/xata.js";

describe("XataChatMessageHistory", () => {
  if (!process.env.XATA_API_KEY) {
    throw new Error("XATA_API_KEY not set");
  }

  if (!process.env.XATA_DB_URL) {
    throw new Error("XATA_DB_URL not set");
  }
  const xata = new BaseClient({
    databaseURL: process.env.XATA_DB_URL,
    apiKey: process.env.XATA_API_KEY,
    branch: process.env.XATA_BRANCH || "main",
  });

  const randomSessionId = (): string =>
    [...Array(6)]
      .map(() => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)])
      .join("");

  afterAll(async () => {
    const records = await xata.db.memory.select(["id"]).getAll();
    await xata.db.memory.delete(records.map((m) => m.id));
  });

  test("Test Xata history store", async () => {
    const chatHistory = new XataChatMessageHistory({
      sessionId: randomSessionId(),
      client: xata,
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

  test("Test Xata memory with Buffer Memory", async () => {
    const memory = new BufferMemory({
      returnMessages: true,
      chatHistory: new XataChatMessageHistory({
        sessionId: randomSessionId(),
        client: xata,
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
  });

  test("Test Xata memory with LLM Chain", async () => {
    const memory = new BufferMemory({
      chatHistory: new XataChatMessageHistory({
        sessionId: randomSessionId(),
        client: xata,
      }),
    });

    const model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
    });
    const chain = new ConversationChain({ llm: model, memory });

    const res1 = await chain.call({ input: "Hi! I'm Jim." });
    console.log({ res1 });

    const res2 = await chain.call({
      input: "What did I just say my name was?",
    });
    console.log({ res2 });
  });
});
