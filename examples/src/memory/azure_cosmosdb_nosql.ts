import { ChatOpenAI } from "@langchain/openai";
import { AzureCosmsosDBNoSQLChatMessageHistory } from "@langchain/azure-cosmosdb";
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

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chain,
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
  getMessageHistory: async (sessionId) => {
    const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory({
      sessionId,
      userId: "user-id",
      databaseName: "DATABASE_NAME",
      containerName: "CONTAINER_NAME",
    });
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
