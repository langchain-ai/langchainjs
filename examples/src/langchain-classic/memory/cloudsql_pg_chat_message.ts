import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  PostgresChatMessageHistory,
  PostgresEngine,
  PostgresEngineArgs,
} from "@langchain/google-cloud-sql-pg";
import * as dotenv from "dotenv";

dotenv.config();

const peArgs: PostgresEngineArgs = {
  user: process.env.DB_USER ?? "",
  password: process.env.PASSWORD ?? "",
};

// PostgresEngine instantiation
const engine: PostgresEngine = await PostgresEngine.fromInstance(
  process.env.PROJECT_ID ?? "",
  process.env.REGION ?? "",
  process.env.INSTANCE_NAME ?? "",
  process.env.DB_NAME ?? "",
  peArgs
);

// Chat history table initialization
await engine.initChatHistoryTable("my_chat_history_table");

// PostgresChatMessageHistory instantiation
const historyInstance: PostgresChatMessageHistory =
  await PostgresChatMessageHistory.initialize(
    engine,
    "test",
    "my_chat_history_table"
  );

// Adding messages to the ChatHistory
const msg1: HumanMessage = new HumanMessage("Hi!");
const msg2: AIMessage = new AIMessage("what's up?");
const msg3: HumanMessage = new HumanMessage("How are you?");
const messages: BaseMessage[] = [msg1, msg2, msg3];
await historyInstance.addMessages(messages);

// Query the ChatHistory table to ensure messages were added
const messagesSaved: BaseMessage[] = await historyInstance.getMessages();
console.log(messagesSaved);

// Clearing all messages added to the ChatHistory
await historyInstance.clear();
