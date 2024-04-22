import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import { AstraDBChatMessageHistory } from "@langchain/community/stores/message/astradb";

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
    const chatHistory = await AstraDBChatMessageHistory.initialize({
      token: process.env.ASTRA_DB_APPLICATION_TOKEN as string,
      endpoint: process.env.ASTRA_DB_ENDPOINT as string,
      namespace: process.env.ASTRA_DB_NAMESPACE,
      collectionName: "YOUR_COLLECTION_NAME",
      sessionId,
    });
    return chatHistory;
  },
});

const res1 = await chainWithHistory.invoke(
  {
    input: "Hi! I'm Jim.",
  },
  { configurable: { sessionId: "langchain-test-session" } }
);
console.log({ res1 });
/*
{
  res1: {
    text: "Hello Jim! It's nice to meet you. My name is AI. How may I assist you today?"
  }
}
*/

const res2 = await chainWithHistory.invoke(
  { input: "What did I just say my name was?" },
  { configurable: { sessionId: "langchain-test-session" } }
);
console.log({ res2 });

/*
{
  res2: {
    text: "You said your name was Jim."
  }
}
*/
