/* eslint-disable no-process-env */
import { test, expect, describe } from "@jest/globals";
import { Client } from "cassandra-driver";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { CassandraChatMessageHistory } from "../message/cassandra.js";

const cassandraConfig = {
  cloud: {
    secureConnectBundle: process.env.CASSANDRA_SCB as string,
  },
  credentials: {
    username: "token",
    password: process.env.CASSANDRA_TOKEN as string,
  },
  keyspace: "test",
  table: "test_message_history",
};
const client = new Client(cassandraConfig);

// yarn test:single /langchain/src/stores/tests/cassandra.int.test.ts
describe.skip("CassandraChatMessageHistory", () => {
  beforeAll(async () => {
    await client.execute("DROP TABLE IF EXISTS test.test_message_history;");
  });

  test("CassandraChatMessageHistory: empty history", async () => {
    const messageHistory = new CassandraChatMessageHistory({
      ...cassandraConfig,
      sessionId: "test_session_A123",
    });
    expect(await messageHistory.getMessages()).toEqual([]);
  });

  test("CassandraChatMessageHistory: add and get messages", async () => {
    const messageHistory = new CassandraChatMessageHistory({
      ...cassandraConfig,
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

    const messageHistoryDifferentSession = new CassandraChatMessageHistory({
      ...cassandraConfig,
      sessionId: "test_session_B456",
    });
    expect(await messageHistoryDifferentSession.getMessages()).toEqual([]);

    const messageHistorySameSession = new CassandraChatMessageHistory({
      ...cassandraConfig,
      sessionId: "test_session_B123",
    });
    expect(await messageHistorySameSession.getMessages()).toEqual(
      expectedMessages
    );
  });

  test("CassandraChatMessageHistory: clear messages", async () => {
    const messageHistory = new CassandraChatMessageHistory({
      ...cassandraConfig,
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

    const messageHistoryToClear = new CassandraChatMessageHistory({
      ...cassandraConfig,
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
