/* eslint-disable no-process-env */
// eslint-disable-next-line import/no-extraneous-dependencies
import { BaseClient } from "@xata.io/client";
import { AIMessage, HumanMessage } from "../../schema/index.js";
import { BufferMemory } from "../../memory/buffer_memory.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { ConversationChain } from "../../chains/conversation.js";
import { XataChatMessageHistory } from "../message/xata.js";

describe("XataChatMessageHistory", () => {
  const randomSessionId = (): string =>
    [...Array(6)]
      .map(() => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)])
      .join("");

  afterAll(async () => {
    const xata = new BaseClient({
      databaseURL: process.env.XATA_DB_URL,
      apiKey: process.env.XATA_API_KEY,
      branch: process.env.XATA_BRANCH || "main",
    });
    const records = await xata.db.memory.select(["id"]).getAll();
    await xata.db.memory.delete(records.map((m) => m.id));
  });

  test.skip("Test Xata history store", async () => {
    const xata = new BaseClient({
      databaseURL: process.env.XATA_DB_URL,
      apiKey: process.env.XATA_API_KEY,
      branch: process.env.XATA_BRANCH || "main",
    });
    const chatHistory = new XataChatMessageHistory({
      sessionId: randomSessionId(),
      client: xata,
      apiKey: process.env.XATA_API_KEY,
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

  test.skip("Test Xata memory with Buffer Memory", async () => {
    const xata = new BaseClient({
      databaseURL: process.env.XATA_DB_URL,
      apiKey: process.env.XATA_API_KEY,
      branch: process.env.XATA_BRANCH || "main",
    });
    const memory = new BufferMemory({
      returnMessages: true,
      chatHistory: new XataChatMessageHistory({
        sessionId: randomSessionId(),
        client: xata,
        apiKey: process.env.XATA_API_KEY,
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

  test.skip("Test Xata memory with LLM Chain", async () => {
    const xata = new BaseClient({
      databaseURL: process.env.XATA_DB_URL,
      apiKey: process.env.XATA_API_KEY,
      branch: process.env.XATA_BRANCH || "main",
    });
    const memory = new BufferMemory({
      chatHistory: new XataChatMessageHistory({
        sessionId: randomSessionId(),
        client: xata,
        apiKey: process.env.XATA_API_KEY,
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

  test.skip("Test Xata don't create table", async () => {
    const xata = new BaseClient({
      databaseURL: process.env.XATA_DB_URL,
      apiKey: process.env.XATA_API_KEY,
      branch: process.env.XATA_BRANCH || "main",
    });
    const t = () => {
      // eslint-disable-next-line no-new
      new XataChatMessageHistory({
        sessionId: randomSessionId(),
        client: xata,
        createTable: true,
      });
    };
    expect(t).toThrowError(
      "If createTable is set, an apiKey must be provided to XataChatMessageHistoryInput, either directly or through the config object"
    );

    const t1 = () => {
      // eslint-disable-next-line no-new
      new XataChatMessageHistory({
        sessionId: randomSessionId(),
        client: xata,
        createTable: false,
      });
    };
    expect(t1).not.toThrow();
  });
});
