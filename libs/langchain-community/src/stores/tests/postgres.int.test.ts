import { v4 as uuidv4 } from "uuid";
import pg from "pg";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { PostgresChatMessageHistory } from "../message/postgres.js";

describe.skip("Postgres Chat History", () => {
  let chatHistory: PostgresChatMessageHistory;
  let pool: pg.Pool;
  const tableName = "test";
  const sessionId = uuidv4();

  beforeAll(async () => {
    pool = new pg.Pool({
      host: "127.0.0.1",
      port: 5433,
      user: "myuser",
      password: "ChangeMe",
      database: "api",
    });
    chatHistory = new PostgresChatMessageHistory({
      tableName,
      sessionId,
      pool,
    });
  });

  afterEach(async () => {
    await chatHistory.clear();
  });

  afterAll(async () => {
    await chatHistory.end();
  });

  test("Test postgres history store", async () => {
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

  test("Test clear postgres history store", async () => {
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
});
