import { test, expect } from "@jest/globals";

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MemoryDatastore } from "datastore-core";
import { IPFSDatastoreChatMessageHistory } from "../message/ipfs_datastore.js";

describe.skip("IPFSDatastoreChatMessageHistory", () => {
  const datastore = new MemoryDatastore();

  test("IPFSDatastoreChatMessageHistory: empty history", async () => {
    const messageHistory = new IPFSDatastoreChatMessageHistory({
      datastore,
      sessionId: "test_session_A123",
    });

    expect(await messageHistory.getMessages()).toEqual([]);
  });

  test("IPFSDatastoreChatMessageHistory: add and get messages", async () => {
    const messageHistory = new IPFSDatastoreChatMessageHistory({
      datastore,
      sessionId: "test_session_B123",
    });

    await messageHistory.addUserMessage("I am a nice human.");
    await messageHistory.addAIChatMessage(
      "Yes you seem to be. I am a nice AI."
    );
    await messageHistory.addUserMessage("We will see about that.");

    const expectedMessages = [
      new HumanMessage("I am a nice human."),
      new AIMessage("Yes you seem to be. I am a nice AI."),
      new HumanMessage("We will see about that."),
    ];

    expect(await messageHistory.getMessages()).toEqual(expectedMessages);

    const messageHistoryDifferentSession = new IPFSDatastoreChatMessageHistory({
      datastore,
      sessionId: "test_session_B456",
    });
    expect(await messageHistoryDifferentSession.getMessages()).toEqual([]);

    const messageHistorySameSession = new IPFSDatastoreChatMessageHistory({
      datastore,
      sessionId: "test_session_B123",
    });
    expect(await messageHistorySameSession.getMessages()).toEqual(
      expectedMessages
    );
  });

  test("IPFSDatastoreChatMessageHistory: clear messages", async () => {
    const messageHistory = new IPFSDatastoreChatMessageHistory({
      datastore,
      sessionId: "test_session_C123",
    });
    await messageHistory.addUserMessage("I am a nice human.");
    await messageHistory.addAIChatMessage(
      "Yes you seem to be. I am a nice AI."
    );
    await messageHistory.addUserMessage("We will see about that.");
    const expectedMessages = [
      new HumanMessage("I am a nice human."),
      new AIMessage("Yes you seem to be. I am a nice AI."),
      new HumanMessage("We will see about that."),
    ];

    const messageHistoryToClear = new IPFSDatastoreChatMessageHistory({
      datastore,
      sessionId: "test_session_C789",
    });
    await messageHistoryToClear.addUserMessage("Hello.");
    await messageHistoryToClear.addAIChatMessage("Hello. How may I help?");
    const expectedMessagesToClear = [
      new HumanMessage("Hello."),
      new AIMessage("Hello. How may I help?"),
    ];
    expect(await messageHistoryToClear.getMessages()).toEqual(
      expectedMessagesToClear
    );

    await messageHistoryToClear.clear();
    expect(await messageHistoryToClear.getMessages()).toEqual([]);
    expect(await messageHistory.getMessages()).toEqual(expectedMessages);
  });
});
