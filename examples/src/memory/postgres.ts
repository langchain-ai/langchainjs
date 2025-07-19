import pg from "pg";

import { PostgresChatMessageHistory } from "@langchain/community/stores/message/postgres";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const poolConfig = {
  host: "127.0.0.1",
  port: 5432,
  user: "myuser",
  password: "ChangeMe",
  database: "api",
};

const pool = new pg.Pool(poolConfig);

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
    const chatHistory = new PostgresChatMessageHistory({
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
