import { test } from "@jest/globals";
import * as dotenv from "dotenv";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import PostgresEngine, { PostgresEngineArgs } from "../engine.js";
import { PostgresChatMessageHistory } from "../chatMessageHistory.js";

dotenv.config()

const CHAT_MSG_TABLE = "test_message_table";
const HOST = "127.0.0.1";
const USER = "myuser";
const PASSWORD = "ChangeMe";
const DATABASE_NAME = "api";
const url = `postgresql+asyncpg://${USER}:${PASSWORD}@${HOST}:5432/${DATABASE_NAME}`;

const pgArgs: PostgresEngineArgs = {
  // eslint-disable-next-line no-process-env
  user: process.env.DB_USER ?? "",
  // eslint-disable-next-line no-process-env
  password: process.env.PASSWORD ?? ""
}

describe("ChatMessageHistory creation", () => {
  let PEInstance: PostgresEngine;

  beforeAll(async () => {
    PEInstance = await PostgresEngine.fromEngineArgs(
      url,
    );

    await PEInstance.pool.raw(`DROP TABLE IF EXISTS ${CHAT_MSG_TABLE}`)

  });

  test("should throw an Error if the table has incorrect schema", async () => {
    await PEInstance.pool.raw(
      `CREATE TABLE IF NOT EXISTS public.${CHAT_MSG_TABLE}(
      my_id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      data JSONB NOT NULL,
      type TEXT NOT NULL);`
    )

    async function createChatMsgInstance() {
      await PostgresChatMessageHistory.create(PEInstance, "test", CHAT_MSG_TABLE)
    }

    await expect(createChatMsgInstance).rejects.toThrowError(
      new Error(
        `Table 'public'.'${CHAT_MSG_TABLE}' has incorrect schema.
        Got column names my_id,session_id,data,type but required column names id,session_id,data,type.\n
        Please create table with following schema: \nCREATE TABLE 'public'.'${CHAT_MSG_TABLE}' (
        \n    id SERIAL AUTO_INCREMENT PRIMARY KEY,
        \n    session_id TEXT NOT NULL,
        \n    data JSONB NOT NULL,
        \n    type TEXT NOT NULL
        \n);
      `)
    );

    await PEInstance.pool.raw(`DROP TABLE ${CHAT_MSG_TABLE}`)
  })

  test("should create a new PostgresChatMessageHistory instance", async () => {
    await PEInstance.initChatHistoryTable(CHAT_MSG_TABLE)

    const historyInstace = await PostgresChatMessageHistory.create(PEInstance, "test", CHAT_MSG_TABLE)

    expect(historyInstace).toBeDefined();
  })

  afterAll(async () => {
    await PEInstance.pool.raw(`DROP TABLE "${CHAT_MSG_TABLE}"`)

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  })
});


describe("ChatMessageHistory methods", () => {
  let PEInstance: PostgresEngine;
  let historyInstace: PostgresChatMessageHistory;

  beforeAll(async () => {
    PEInstance = await PostgresEngine.fromEngineArgs(
      url,
    );

    await PEInstance.pool.raw(`DROP TABLE IF EXISTS ${CHAT_MSG_TABLE}`)
    await PEInstance.initChatHistoryTable(CHAT_MSG_TABLE)
    historyInstace = await PostgresChatMessageHistory.create(PEInstance, "test", CHAT_MSG_TABLE)
  });

  test("should add a message to the store", async () => {
    const msg1 = new HumanMessage("Hi!")
    const msg2 = new AIMessage("what's up?")

    await historyInstace.addMessage(msg1);
    await historyInstace.addMessage(msg2)

    const { rows } = await PEInstance.pool.raw(`SELECT * FROM "${CHAT_MSG_TABLE}"`);
    expect(rows).toHaveLength(2);
  });

  test("should add a list of messages to the store", async () => {
    await PEInstance.pool.raw(`TRUNCATE TABLE "${CHAT_MSG_TABLE}"`);
    const msg1 = new HumanMessage("Hi!")
    const msg2 = new AIMessage("what's up?")
    const msg3 = new HumanMessage("How are you?")
    const messages: BaseMessage[] = [msg1, msg2, msg3]
    await historyInstace.addMessages(messages);

    const { rows } = await PEInstance.pool.raw(`SELECT * FROM "${CHAT_MSG_TABLE}"`);
    expect(rows).toHaveLength(3);
  });

  test("should get the messages added to the store", async () => {
    await PEInstance.pool.raw(`TRUNCATE TABLE "${CHAT_MSG_TABLE}"`);
    const msg1 = new HumanMessage("Hi!");
    const msg2 = new AIMessage("what's up?");

    await historyInstace.addMessages([msg1, msg2]);

    const messages = await historyInstace.getMessages();

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("Hi!");
    expect(messages[1].content).toBe("what's up?");

    const transformed = messages.map((message) =>
      message.getType() === "human"
        ? new HumanMessage(message)
        : new AIMessage(message)
    );

    expect(transformed[0]).toBeInstanceOf(HumanMessage)
    expect(transformed[1]).toBeInstanceOf(AIMessage)
  });

  test("should clear all messages added to the store", async () => {
    await historyInstace.clear();
    const messages = await historyInstace.getMessages();
    expect(messages.length).toBe(0)
  });

  afterAll(async () => {
    await PEInstance.pool.raw(`DROP TABLE "${CHAT_MSG_TABLE}"`)

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  })
});