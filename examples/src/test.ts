import { ChatMessageHistory } from "@langchain/community/stores/message/in_memory";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  RunnableSequence,
  RunnableWithMessageHistory,
} from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { RunnablePassthrough } from "@langchain/core/runnables";

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
});

const store: Record<string, BaseChatMessageHistory> = {};

async function getMessageHistory(
  sessionId: string
): Promise<BaseChatMessageHistory> {
  if (!(sessionId in store)) {
    store[sessionId] = new ChatMessageHistory();
  }
  return store[sessionId];
}

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. Answer all questions to the best of your ability in {language}.",
  ],
  new MessagesPlaceholder("messages"),
]);

// const chain = prompt.pipe(model)

// const withMessageHistory = new RunnableWithMessageHistory({
//   runnable: chain,
//   getMessageHistory,
//   inputMessagesKey: "messages",
// })

const filterMessages = (messages: BaseMessage[], k = 10) => {
  return messages.slice(-k);
};

const chain = RunnableSequence.from([
  RunnablePassthrough.assign({
    messages: (input: Record<string, any>) => filterMessages(input.messages),
  }),
  prompt,
  model,
]);

const messages = [
  new HumanMessage("hi! I'm bob"),
  new AIMessage("hi!"),
  new HumanMessage("I like vanilla ice cream"),
  new AIMessage("nice"),
  new HumanMessage("whats 2 + 2"),
  new AIMessage("4"),
  new HumanMessage("thanks"),
  new AIMessage("no problem!"),
  new HumanMessage("having fun?"),
  new AIMessage("yes!"),
];

const response = await chain.invoke({
  messages: [...messages, new HumanMessage("what's my name?")],
  language: "English",
});

console.log({
  response: response.content,
});

const response2 = await chain.invoke({
  messages: [...messages, new HumanMessage("what's my fav ice cream")],
  language: "English",
});

console.log({
  response2: response2.content,
});

const withMessageHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory,
  inputMessagesKey: "messages",
});

const config = { configurable: { sessionId: "abc15" } };

for await (const r of await withMessageHistory.stream({
  messages: [new HumanMessage("hi! I'm todd. tell me a joke")],
  language: "English",
}, config)) {
  console.log(r);
}