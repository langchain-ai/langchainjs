/* eslint-disable import/first */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-duplicates */

import { ChatOpenAI } from "@langchain/openai";

const chat = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
});

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. Answer all questions to the best of your ability.",
  ],
  new MessagesPlaceholder("messages"),
]);

const chain = prompt.pipe(chat);

console.log(
  await chain.invoke({
    messages: [
      new HumanMessage(
        "Translate this sentence from English to French: I love programming."
      ),
      new AIMessage("J'adore la programmation."),
      new HumanMessage("What did you just say?"),
    ],
  })
);

import { ChatMessageHistory } from "langchain/stores/message/in_memory";

const demoEphemeralChatMessageHistory = new ChatMessageHistory();

await demoEphemeralChatMessageHistory.addMessage(new HumanMessage("hi!"));

await demoEphemeralChatMessageHistory.addMessage(new AIMessage("whats up?"));

console.log(await demoEphemeralChatMessageHistory.getMessages());

await demoEphemeralChatMessageHistory.clear();

const input1 =
  "Translate this sentence from English to French: I love programming.";

await demoEphemeralChatMessageHistory.addMessage(new HumanMessage(input1));

const response = await chain.invoke({
  messages: await demoEphemeralChatMessageHistory.getMessages(),
});

await demoEphemeralChatMessageHistory.addMessage(response);

const input2 = "What did I just ask you?";

await demoEphemeralChatMessageHistory.addMessage(new HumanMessage(input2));

console.log(
  await chain.invoke({
    messages: await demoEphemeralChatMessageHistory.getMessages(),
  })
);

const runnableWithMessageHistoryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. Answer all questions to the best of your ability.",
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

const chain2 = runnableWithMessageHistoryPrompt.pipe(chat);

import { RunnableWithMessageHistory } from "@langchain/core/runnables";

const demoEphemeralChatMessageHistoryForChain = new ChatMessageHistory();

const chainWithMessageHistory = new RunnableWithMessageHistory({
  runnable: chain2,
  getMessageHistory: (_sessionId) => demoEphemeralChatMessageHistoryForChain,
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
});

console.log(
  await chainWithMessageHistory.invoke(
    {
      input:
        "Translate this sentence from English to French: I love programming.",
    },
    { configurable: { sessionId: "unused" } }
  )
);

console.log(
  await chainWithMessageHistory.invoke(
    {
      input: "What did I just ask you?",
    },
    { configurable: { sessionId: "unused" } }
  )
);

await demoEphemeralChatMessageHistory.clear();

await demoEphemeralChatMessageHistory.addMessage(
  new HumanMessage("Hey there! I'm Nemo.")
);

await demoEphemeralChatMessageHistory.addMessage(new AIMessage("Hello!"));

await demoEphemeralChatMessageHistory.addMessage(
  new HumanMessage("How are you today?")
);

await demoEphemeralChatMessageHistory.addMessage(new AIMessage("Fine thanks!"));

console.log(await demoEphemeralChatMessageHistory.getMessages());

const chainWithMessageHistory2 = new RunnableWithMessageHistory({
  runnable: chain2,
  getMessageHistory: (_sessionId) => demoEphemeralChatMessageHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
});

console.log(
  await chainWithMessageHistory2.invoke(
    {
      input: "What's my name?",
    },
    { configurable: { sessionId: "unused" } }
  )
);

import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";

const trimMessages = async (_chainInput: Record<string, any>) => {
  const storedMessages = await demoEphemeralChatMessageHistory.getMessages();
  if (storedMessages.length <= 2) {
    return false;
  }
  await demoEphemeralChatMessageHistory.clear();
  for (const message of storedMessages.slice(-2)) {
    demoEphemeralChatMessageHistory.addMessage(message);
  }
  return true;
};

const chainWithTrimming = RunnableSequence.from([
  RunnablePassthrough.assign({ messages_trimmed: trimMessages }),
  chainWithMessageHistory2,
]);

console.log(
  await chainWithTrimming.invoke(
    {
      input: "Where does P. Sherman live?",
    },
    { configurable: { sessionId: "unused" } }
  )
);

console.log(await demoEphemeralChatMessageHistory.getMessages());

console.log(
  await chainWithTrimming.invoke(
    {
      input: "What is my name?",
    },
    { configurable: { sessionId: "unused" } }
  )
);

console.log(await demoEphemeralChatMessageHistory.getMessages());

await demoEphemeralChatMessageHistory.clear();

await demoEphemeralChatMessageHistory.addMessage(
  new HumanMessage("Hey there! I'm Nemo.")
);

await demoEphemeralChatMessageHistory.addMessage(new AIMessage("Hello!"));

await demoEphemeralChatMessageHistory.addMessage(
  new HumanMessage("How are you today?")
);

await demoEphemeralChatMessageHistory.addMessage(new AIMessage("Fine thanks!"));

console.log(await demoEphemeralChatMessageHistory.getMessages());

const runnableWithSummaryMemoryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. Answer all questions to the best of your ability. The provided chat history includes facts about the user you are speaking with.",
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

const summaryMemoryChain = runnableWithSummaryMemoryPrompt.pipe(chat);

const chainWithMessageHistory3 = new RunnableWithMessageHistory({
  runnable: summaryMemoryChain,
  getMessageHistory: (_sessionId) => demoEphemeralChatMessageHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history",
});

const summarizeMessages = async (_chainInput: Record<string, any>) => {
  const storedMessages = await demoEphemeralChatMessageHistory.getMessages();
  if (storedMessages.length === 0) {
    return false;
  }
  const summarizationPrompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("chat_history"),
    [
      "user",
      "Distill the above chat messages into a single summary message. Include as many specific details as you can.",
    ],
  ]);
  const summarizationChain = summarizationPrompt.pipe(chat);
  const summaryMessage = await summarizationChain.invoke({
    chat_history: storedMessages,
  });
  await demoEphemeralChatMessageHistory.clear();
  demoEphemeralChatMessageHistory.addMessage(summaryMessage);
  return true;
};

const chainWithSummarization = RunnableSequence.from([
  RunnablePassthrough.assign({
    messages_summarized: summarizeMessages,
  }),
  chainWithMessageHistory3,
]);

console.log(
  await chainWithSummarization.invoke(
    {
      input: "What did I say my name was?",
    },
    {
      configurable: { sessionId: "unused" },
    }
  )
);
