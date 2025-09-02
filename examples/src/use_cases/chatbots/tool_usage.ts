/* eslint-disable import/first */
/* eslint-disable arrow-body-style */
/* eslint-disable import/no-duplicates */

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { type Runnable } from "@langchain/core/runnables";

const tools = [
  new TavilySearchResults({
    maxResults: 1,
  }),
];

const chat = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
  temperature: 0,
});

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

// Adapted from https://smith.langchain.com/hub/hwchase17/openai-tools-agent
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. You may not need to use tools for every query - the user may just want to chat!",
  ],
  new MessagesPlaceholder("messages"),
  new MessagesPlaceholder("agent_scratchpad"),
]);

import { createAgent } from "langchain";

const agent = await createAgent({
  llm: chat,
  tools,
  prompt,
});

import { HumanMessage } from "@langchain/core/messages";

console.log(await agent.invoke({ messages: [new HumanMessage("I'm Nemo!")] }));

console.log(
  await agent.invoke({
    messages: [
      new HumanMessage(
        "What is the current conservation status of the Great Barrier Reef?"
      ),
    ],
  })
);

import { AIMessage } from "@langchain/core/messages";

console.log(
  await agent.invoke({
    messages: [
      new HumanMessage("I'm Nemo!"),
      new AIMessage("Hello Nemo! How can I assist you today?"),
      new HumanMessage("What is my name?"),
    ],
  })
);

// Adapted from https://smith.langchain.com/hub/hwchase17/openai-tools-agent
const prompt2 = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. You may not need to use tools for every query - the user may just want to chat!",
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const agent2 = await createAgent({
  llm: chat,
  tools,
  prompt: prompt2,
});

import { ChatMessageHistory } from "@langchain/community/stores/message/in_memory";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";

const demoEphemeralChatMessageHistory = new ChatMessageHistory();

const conversationalAgent = new RunnableWithMessageHistory({
  runnable: agent2 as unknown as Runnable,
  getMessageHistory: (_sessionId) => demoEphemeralChatMessageHistory,
  inputMessagesKey: "input",
  outputMessagesKey: "output",
  historyMessagesKey: "chat_history",
});

console.log(
  await conversationalAgent.invoke(
    { input: "I'm Nemo!" },
    { configurable: { sessionId: "unused" } }
  )
);

console.log(
  await conversationalAgent.invoke(
    { input: "What is my name?" },
    { configurable: { sessionId: "unused" } }
  )
);
