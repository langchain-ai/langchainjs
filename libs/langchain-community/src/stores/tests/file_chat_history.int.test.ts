import { expect } from "@jest/globals";
import { promises as fs } from "node:fs";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { v4 as uuid } from "uuid";
import {
  FILE_HISTORY_DEFAULT_FILE_PATH,
  FileSystemChatMessageHistory,
} from "../message/file_system.js";

afterAll(async () => {
  try {
    await fs.unlink(FILE_HISTORY_DEFAULT_FILE_PATH);
  } catch {
    // Ignore error if the file does not exist
  }
});

test("FileSystemChatMessageHistory works", async () => {
  const input = {
    sessionId: uuid(),
  };
  const chatHistory = new FileSystemChatMessageHistory(input);
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

test("FileSystemChatMessageHistory persist sessions", async () => {
  const input = {
    sessionId: uuid(),
  };
  const chatHistory1 = new FileSystemChatMessageHistory(input);
  const blankResult = await chatHistory1.getMessages();
  expect(blankResult).toStrictEqual([]);

  await chatHistory1.addUserMessage("Who is the best vocalist?");
  await chatHistory1.addAIMessage("Ozzy Osbourne");

  const chatHistory2 = new FileSystemChatMessageHistory(input);
  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];
  const resultWithHistory = await chatHistory2.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);
});

test("FileSystemChatMessageHistory clear session", async () => {
  const input = {
    sessionId: uuid(),
    userId: uuid(),
  };
  const chatHistory = new FileSystemChatMessageHistory(input);

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

test("FileSystemChatMessageHistory clear all sessions", async () => {
  const input1 = {
    sessionId: uuid(),
    userId: "user1",
  };
  const chatHistory1 = new FileSystemChatMessageHistory(input1);

  await chatHistory1.addUserMessage("Who is the best vocalist?");
  await chatHistory1.addAIMessage("Ozzy Osbourne");

  const input2 = {
    sessionId: uuid(),
    userId: "user1",
  };
  const chatHistory2 = new FileSystemChatMessageHistory(input2);

  await chatHistory2.addUserMessage("Who is the best vocalist?");
  await chatHistory2.addAIMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];

  const result1 = await chatHistory1.getMessages();
  expect(result1).toEqual(expectedMessages);

  const result2 = await chatHistory2.getMessages();
  expect(result2).toEqual(expectedMessages);

  await chatHistory1.clearAllSessions();

  const deletedResult1 = await chatHistory1.getMessages();
  const deletedResult2 = await chatHistory2.getMessages();
  expect(deletedResult1).toStrictEqual([]);
  expect(deletedResult2).toStrictEqual([]);
});

test("FileSystemChatMessageHistory set context and get all sessions", async () => {
  const session1 = {
    sessionId: uuid(),
    userId: "user1",
  };
  const context1 = { title: "Best vocalist" };
  const chatHistory1 = new FileSystemChatMessageHistory(session1);

  await chatHistory1.setContext(context1);
  await chatHistory1.addUserMessage("Who is the best vocalist?");
  await chatHistory1.addAIMessage("Ozzy Osbourne");

  const chatHistory2 = new FileSystemChatMessageHistory({
    sessionId: uuid(),
    userId: "user1",
  });
  const context2 = { title: "Best guitarist" };

  await chatHistory2.addUserMessage("Who is the best guitarist?");
  await chatHistory2.addAIMessage("Jimi Hendrix");
  await chatHistory2.setContext(context2);

  const sessions = await chatHistory1.getAllSessions();

  expect(sessions.length).toBe(2);
  expect(sessions[0].context).toEqual(context1);
  expect(sessions[0].id).toBeDefined();
  expect(sessions[1].context).toEqual(context2);
  expect(sessions[1].id).toBeDefined();
});
