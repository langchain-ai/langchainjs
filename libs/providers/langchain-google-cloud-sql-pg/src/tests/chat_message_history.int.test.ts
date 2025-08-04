import { test } from "@jest/globals";

import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import PostgresEngine from "../engine.js";
import { PostgresChatMessageHistory } from "../chat_message_history.js";

const CHAT_MSG_TABLE = "test_message_table";
const CHAT_MSG_TABLE_ERR = "test_message_table_err";
let url: string;
let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer("pgvector/pgvector:pg16").start();

  url = `postgresql+asyncpg://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;
});

afterAll(async () => {
  await container.stop();
});

describe("ChatMessageHistory creation", () => {
  let PEInstance: PostgresEngine;

  beforeAll(async () => {
    PEInstance = await PostgresEngine.fromConnectionString(url);

    await PEInstance.pool.raw(`DROP TABLE IF EXISTS ${CHAT_MSG_TABLE}`);
  });

  test("should throw an Error if the table has incorrect schema", async () => {
    await PEInstance.pool.raw(
      `CREATE TABLE IF NOT EXISTS public.${CHAT_MSG_TABLE_ERR}(
        my_id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        data JSON NOT NULL,
        type TEXT NOT NULL
      );`
    );

    async function createChatMsgInstance() {
      await PostgresChatMessageHistory.initialize(
        PEInstance,
        "test",
        CHAT_MSG_TABLE_ERR
      );
    }

    await expect(createChatMsgInstance).rejects.toThrow(
      new Error(
        `Table 'public'.'test_message_table_err' has incorrect schema.
        Got column names my_id,session_id,data,type but required column names id,session_id,data,type.
        Please create table with following schema: CREATE TABLE 'public'.'test_message_table_err' (
            id SERIAL AUTO_INCREMENT PRIMARY KEY,
            session_id TEXT NOT NULL,
            data JSONB NOT NULL,
            type TEXT NOT NULL
        );
      `
      )
    );

    await PEInstance.pool.raw(`DROP TABLE ${CHAT_MSG_TABLE_ERR}`);
  });

  test("should create a new PostgresChatMessageHistory instance", async () => {
    await PEInstance.initChatHistoryTable(CHAT_MSG_TABLE);

    const historyInstance = await PostgresChatMessageHistory.initialize(
      PEInstance,
      "test",
      CHAT_MSG_TABLE
    );

    expect(historyInstance).toBeDefined();
  });

  afterAll(async () => {
    await PEInstance.pool.raw(`DROP TABLE "${CHAT_MSG_TABLE}"`);

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  });
});

describe("ChatMessageHistory methods", () => {
  let PEInstance: PostgresEngine;
  let historyInstance: PostgresChatMessageHistory;

  beforeAll(async () => {
    PEInstance = await PostgresEngine.fromConnectionString(url);

    await PEInstance.pool.raw(`DROP TABLE IF EXISTS ${CHAT_MSG_TABLE}`);
    await PEInstance.initChatHistoryTable(CHAT_MSG_TABLE);
    historyInstance = await PostgresChatMessageHistory.initialize(
      PEInstance,
      "test",
      CHAT_MSG_TABLE
    );
  });

  test("should add a message to the store", async () => {
    const msg1 = new HumanMessage("Hi!");
    const msg2 = new AIMessage("what's up?");

    await historyInstance.addMessage(msg1);
    await historyInstance.addMessage(msg2);

    const { rows } = await PEInstance.pool.raw(
      `SELECT * FROM "${CHAT_MSG_TABLE}"`
    );
    expect(rows).toHaveLength(2);
  });

  test("should add a list of messages to the store", async () => {
    await PEInstance.pool.raw(`TRUNCATE TABLE "${CHAT_MSG_TABLE}"`);
    const msg1 = new HumanMessage("Hi!");
    const msg2 = new AIMessage("what's up?");
    const msg3 = new HumanMessage("How are you?");
    const messages: BaseMessage[] = [msg1, msg2, msg3];
    await historyInstance.addMessages(messages);

    const { rows } = await PEInstance.pool.raw(
      `SELECT * FROM "${CHAT_MSG_TABLE}"`
    );
    expect(rows).toHaveLength(3);
  });

  test("should get the messages added to the store", async () => {
    await PEInstance.pool.raw(`TRUNCATE TABLE "${CHAT_MSG_TABLE}"`);
    const msg1 = new HumanMessage("Hi!");
    const msg2 = new AIMessage("what's up?");

    await historyInstance.addMessages([msg1, msg2]);

    const messages = await historyInstance.getMessages();

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("Hi!");
    expect(messages[1].content).toBe("what's up?");

    const transformed = messages.map((message) =>
      message.getType() === "human"
        ? new HumanMessage(message)
        : new AIMessage(message)
    );

    expect(transformed[0]).toBeInstanceOf(HumanMessage);
    expect(transformed[1]).toBeInstanceOf(AIMessage);
  });

  test("should clear all messages added to the store", async () => {
    await historyInstance.clear();
    const messages = await historyInstance.getMessages();
    expect(messages.length).toBe(0);
  });

  afterAll(async () => {
    await PEInstance.pool.raw(`DROP TABLE "${CHAT_MSG_TABLE}"`);

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  });
});
