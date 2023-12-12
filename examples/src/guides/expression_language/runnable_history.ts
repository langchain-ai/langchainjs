import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatMessageHistory } from "langchain/memory";
import { ChatPromptTemplate, MessagesPlaceholder } from "langchain/prompts";
import {
  RunnableConfig,
  RunnableWithMessageHistory,
} from "langchain/runnables";

// Instantiate your model and prompt.
const model = new ChatOpenAI({});
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant"],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

// Create a simple runnable which just chains the prompt to the model.
const runnable = prompt.pipe(model);

// Define your session history store.
// This is where you will store your chat history.
const messageHistory = new ChatMessageHistory();

// Create your `RunnableWithMessageHistory` object, passing in the
// runnable created above.
const withHistory = new RunnableWithMessageHistory({
  runnable,
  // Optionally, you can use a function which tracks history by session ID.
  getMessageHistory: (_sessionId: string) => messageHistory,
  inputMessagesKey: "input",
  // This shows the runnable where to insert the history.
  // We set to "history" here because of our MessagesPlaceholder above.
  historyMessagesKey: "history",
});

// Create your `configurable` object. This is where you pass in the
// `sessionId` which is used to identify chat sessions in your message store.
const config: RunnableConfig = { configurable: { sessionId: "1" } };

// Pass in your question, in this example we set the input key
// to be "input" so we need to pass an object with an "input" key.
let output = await withHistory.invoke(
  { input: "Hello there, I'm Archibald!" },
  config
);
console.log("output 1:", output);
/**
output 1: AIMessage {
  lc_namespace: [ 'langchain_core', 'messages' ],
  content: 'Hello, Archibald! How can I assist you today?',
  additional_kwargs: { function_call: undefined, tool_calls: undefined }
}
 */

output = await withHistory.invoke({ input: "What's my name?" }, config);
console.log("output 2:", output);
/**
output 2: AIMessage {
  lc_namespace: [ 'langchain_core', 'messages' ],
  content: 'Your name is Archibald, as you mentioned earlier. Is there anything specific you would like assistance with, Archibald?',
  additional_kwargs: { function_call: undefined, tool_calls: undefined }
}
 */

/**
 * You can see the LangSmith traces here:
 * output 1 @link https://smith.langchain.com/public/686f061e-bef4-4b0d-a4fa-04c107b6db98/r
 * output 2 @link https://smith.langchain.com/public/c30ba77b-c2f4-440d-a54b-f368ced6467a/r
 */
