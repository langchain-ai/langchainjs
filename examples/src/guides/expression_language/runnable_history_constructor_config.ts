import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatMessageHistory } from "langchain/memory";
import { ChatPromptTemplate, MessagesPlaceholder } from "langchain/prompts";
import {
  RunnableConfig,
  RunnableWithMessageHistory,
} from "langchain/runnables";

// Construct your runnable with a prompt and chat model.
const model = new ChatOpenAI({});
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant"],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);
const runnable = prompt.pipe(model);
const messageHistory = new ChatMessageHistory();

// Define a RunnableConfig object, with a `configurable` key.
const config: RunnableConfig = { configurable: { sessionId: "1" } };
const withHistory = new RunnableWithMessageHistory({
  runnable,
  getMessageHistory: (_sessionId: string) => messageHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "history",
  // Passing config through here instead of through the invoke method
  config,
});

const output = await withHistory.invoke({
  input: "Hello there, I'm Archibald!",
});
console.log("output:", output);
/**
output: AIMessage {
  lc_namespace: [ 'langchain_core', 'messages' ],
  content: 'Hello, Archibald! How can I assist you today?',
  additional_kwargs: { function_call: undefined, tool_calls: undefined }
}
 */

/**
 * You can see the LangSmith traces here:
 * output @link https://smith.langchain.com/public/ee264a77-b767-4b5a-8573-efcbebaa5c80/r
 */
