/* eslint-disable no-process-env */
// eslint-disable-next-line import/no-extraneous-dependencies
import { BaseClient } from "@xata.io/client";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { XataChatMessageHistory } from "../message/xata.js";

describe("XataChatMessageHistory", () => {
  const randomSessionId = (): string =>
    [...Array(6)]
      .map(() => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)])
      .join("");

  test("Test Xata history store", async () => {
    const chatHistory = new XataChatMessageHistory({
      sessionId: randomSessionId(),
      config: {
        databaseURL: process.env.XATA_DB_URL,
        apiKey: process.env.XATA_API_KEY,
        branch: process.env.XATA_BRANCH || "main",
      },
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

    await chatHistory.clear();
  });

  test("Test Xata don't create table", async () => {
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
