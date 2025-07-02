import pg from "pg";

import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { AuroraDsqlChatMessageHistory } from "@langchain/community/stores/message/aurora_dsql";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

async function getPostgresqlPool() {
  const signer = new DsqlSigner({
    hostname: process.env.DSQL_ENDPOINT!,
  });

  const token = await signer.getDbConnectAdminAuthToken();

  if (!token) throw new Error("Auth token error for DSQL");

  const poolConfig: pg.PoolConfig = {
    host: process.env.DSQL_ENDPOINT,
    port: 5432,
    user: "admin",
    password: token,
    ssl: true,
    database: "postgres",
  };

  const pool = new pg.Pool(poolConfig);
  return pool;
}

const pool = await getPostgresqlPool();

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. Answer all questions to the best of your ability.",
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chain,
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
  getMessageHistory: async (sessionId) => {
    const chatHistory = new AuroraDsqlChatMessageHistory({
      sessionId,
      pool,
      // Can also pass `poolConfig` to initialize the pool internally,
      // but easier to call `.end()` at the end later.
    });
    return chatHistory;
  },
});

const res1 = await chainWithHistory.invoke(
  {
    input: "Hi! I'm MJDeligan.",
  },
  { configurable: { sessionId: "langchain-test-session" } }
);
console.log(res1);
/*
  "Hello MJDeligan! It's nice to meet you. My name is AI. How may I assist you today?"
*/

const res2 = await chainWithHistory.invoke(
  { input: "What did I just say my name was?" },
  { configurable: { sessionId: "langchain-test-session" } }
);
console.log(res2);

/*
  "You said your name was MJDeligan."
*/

// If you provided a pool config you should close the created pool when you are done
await pool.end();
