import { BaseClient } from "@xata.io/client";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
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

  test.skip("Test Xata don't create table", async () => {
    const xata = new BaseClient({
      databaseURL: process.env.XATA_DB_URL,
      apiKey: process.env.XATA_API_KEY,
      branch: process.env.XATA_BRANCH || "main",
    });
    const t = () => {
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
      new XataChatMessageHistory({
        sessionId: randomSessionId(),
        client: xata,
        createTable: false,
      });
    };
    expect(t1).not.toThrow();
  });
});
