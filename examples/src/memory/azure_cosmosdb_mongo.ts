import { ChatOpenAI } from "@langchain/openai";
import {
  AzureCosmosDBMongoChatMessageHistory,
  AzureCosmosDBMongoChatHistoryDBConfig,
} from "@langchain/azure-cosmosdb";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
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

const dbcfg: AzureCosmosDBMongoChatHistoryDBConfig = {
  connectionString: process.env.AZURE_COSMOSDB_MONGODB_CONNECTION_STRING,
  databaseName: "langchain",
  collectionName: "chathistory",
};

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chain,
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
  getMessageHistory: async (sessionId) => {
    const chatHistory = new AzureCosmosDBMongoChatMessageHistory(
      dbcfg,
      sessionId,
      "user-id"
    );
    return chatHistory;
  },
});

const res1 = await chainWithHistory.invoke(
  { input: "Hi! I'm Jim." },
  { configurable: { sessionId: "langchain-test-session" } }
);
console.log({ res1 });
/*
 { res1: 'Hi Jim! How can I assist you today?' }
 */

const res2 = await chainWithHistory.invoke(
  { input: "What did I just say my name was?" },
  { configurable: { sessionId: "langchain-test-session" } }
);
console.log({ res2 });
/*
 { res2: { response: 'You said your name was Jim.' } 
 */

// Give this session a title
const chatHistory = (await chainWithHistory.getMessageHistory(
  "langchain-test-session"
)) as AzureCosmosDBMongoChatMessageHistory;

await chatHistory.setContext({ title: "Introducing Jim" });

// List all session for the user
const sessions = await chatHistory.getAllSessions();

console.log(sessions);
/*
[
  {
    id: 'langchain-test-session',
    user_id: 'user-id',
    context: { title: 'Introducing Jim' }
  }
]
 */
