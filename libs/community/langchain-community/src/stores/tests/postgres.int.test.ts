import pg from "pg";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { PostgresChatMessageHistory } from "../message/postgres.js";

describe.skip("Postgres Chat History", () => {
  let chatHistory: PostgresChatMessageHistory;
  let pool: pg.Pool;
  const tableName = "test";
  const sessionId = "test-session-id";

  beforeAll(async () => {
    pool = new pg.Pool({
      host: "127.0.0.1",
      port: 5432,
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
    await chatHistory.addAIMessage("Ozzy Osbourne");

    const expectedMessages = [
      new HumanMessage("Who is the best vocalist?"),
      new AIMessage("Ozzy Osbourne"),
    ];

    const resultWithHistory = await chatHistory.getMessages();
    expect(resultWithHistory).toEqual(expectedMessages);
  });

  test("Test clear postgres history store", async () => {
    await chatHistory.addUserMessage("Who is the best vocalist?");
    await chatHistory.addAIMessage("Ozzy Osbourne");

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

  test("Returns messages in correct order", async () => {
    await chatHistory.addUserMessage("Who is the best vocalist?");
    await chatHistory.addAIMessage("Ozzy Osbourne");
    await chatHistory.addUserMessage("What is the best song?");
    await chatHistory.addAIMessage("Crazy Train");

    const expectedMessages = [
      new HumanMessage("Who is the best vocalist?"),
      new AIMessage("Ozzy Osbourne"),
      new HumanMessage("What is the best song?"),
      new AIMessage("Crazy Train"),
    ];

    const resultWithHistory = await chatHistory.getMessages();
    expect(resultWithHistory).toEqual(expectedMessages);
  });

  test("Handles multiple sessions", async () => {
    const newSessionId = "new-session-id";
    const newChatHistory = new PostgresChatMessageHistory({
      tableName,
      sessionId: newSessionId,
      pool,
    });

    try {
      await chatHistory.addUserMessage("Who is the best vocalist?");
      await chatHistory.addAIMessage("Ozzy Osbourne");

      await newChatHistory.addUserMessage("What is the best song?");
      await newChatHistory.addAIMessage("Crazy Train");

      const expectedMessages = [
        new HumanMessage("Who is the best vocalist?"),
        new AIMessage("Ozzy Osbourne"),
      ];

      const newExpectedMessages = [
        new HumanMessage("What is the best song?"),
        new AIMessage("Crazy Train"),
      ];

      const resultWithHistory = await chatHistory.getMessages();
      expect(resultWithHistory).toEqual(expectedMessages);

      const newResultWithHistory = await newChatHistory.getMessages();
      expect(newResultWithHistory).toEqual(newExpectedMessages);

      await newChatHistory.clear();

      const blankResult = await newChatHistory.getMessages();
      expect(blankResult).toStrictEqual([]);

      // Ensure that the original chat history is still intact after clearing the new chat history
      const resultWithHistoryAfterClear = await chatHistory.getMessages();
      expect(resultWithHistoryAfterClear).toEqual(expectedMessages);
    } finally {
      await newChatHistory.clear();
    }
  });

  test("Can store & retrieve message IDs", async () => {
    const blankResult = await chatHistory.getMessages();
    expect(blankResult).toStrictEqual([]);

    const aiMessageId = "ai-message-id";
    const aiMessage = new AIMessage({
      content: "Ozzy Osbourne",
      id: aiMessageId,
    });
    await chatHistory.addMessage(aiMessage);

    const expectedMessages = [aiMessage];

    const resultWithHistory = await chatHistory.getMessages();
    expect(resultWithHistory).toHaveLength(1);
    expect(resultWithHistory).toEqual(expectedMessages);
    expect(resultWithHistory[0].id).toEqual(aiMessageId);
  });
});
