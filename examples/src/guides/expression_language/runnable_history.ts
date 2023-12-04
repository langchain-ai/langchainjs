import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatMessageHistory } from "langchain/memory";
import { ChatPromptTemplate } from "langchain/prompts";
import {
  RunnableConfig,
  RunnableSequence,
  RunnableWithMessageHistory,
} from "langchain/runnables";
import {
  BaseListChatMessageHistory,
  BaseMessage,
  HumanMessage,
} from "langchain/schema";
import { StringOutputParser } from "langchain/schema/output_parser";

// Define your session history store.
// This is where you will store your chat history, keyed by sessionId.
function getListSessionHistory(): (
  sessionId: string
) => BaseListChatMessageHistory {
  const chatHistoryStore: { [key: string]: BaseListChatMessageHistory } = {};

  function getSessionHistory(sessionId: string): BaseListChatMessageHistory {
    if (!chatHistoryStore[sessionId]) {
      chatHistoryStore[sessionId] = new ChatMessageHistory();
    }
    return chatHistoryStore[sessionId];
  }

  return getSessionHistory;
}

// Instantiate your model and prompt.
const model = new ChatOpenAI({});
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant."],
  ["human", "{question}"],
]);

// Create a simple runnable which passes a question to the AI.
const runnable = RunnableSequence.from([
  {
    question: (messages: Array<BaseMessage>) =>
      messages.map((m) => `${m._getType()}: ${m.content}`).join("\n"),
  },
  prompt,
  model,
  new StringOutputParser(),
]);

// Create your `RunnableWithMessageHistory` object, passing in the
// runnable created above.
const withHistory = new RunnableWithMessageHistory({
  runnable,
  config: {},
  getMessageHistory: getListSessionHistory(),
});

// Create your `configurable` object. This is where you pass in the
// `sessionId` which is used to identify chat sessions in your message store.
const config: RunnableConfig = { configurable: { sessionId: "1" } };

// Pass in your question as an instance of HumanMessage.
// This is because in our runnable, we prefix each message
// with the type.
let output = await withHistory.invoke(
  [new HumanMessage("Hello there, I'm Archibald!")],
  config
);
console.log("output 1:", output);
/**
 * output 1: AI: Hello Archibald! How can I assist you today?
 */

output = await withHistory.invoke(
  [new HumanMessage("What's my name?")],
  config
);
console.log("output 2:", output);
/**
 * output 2: AI: Your name is Archibald, as you mentioned earlier. Is there anything else I can help you with?
 */

/**
 * You can see the LangSmith traces here:
 * output 1 @link https://smith.langchain.com/public/f8baefdb-4dd4-4e58-abb3-bbd91da2b543/r
 * output 2 @link https://smith.langchain.com/public/df49265e-b1db-4f43-a47d-f362310bd01f/r
 */
