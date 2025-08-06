/* eslint-disable import/first */
/* eslint-disable import/no-duplicates */
import { BufferMemory } from "langchain/memory";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const memory = new BufferMemory();

await memory.chatHistory.addMessage(new HumanMessage("Hi!"));
await memory.chatHistory.addMessage(new AIMessage("What's up?"));

console.log(await memory.loadMemoryVariables({}));

const memory2 = new BufferMemory({
  memoryKey: "chat_history",
});

await memory2.chatHistory.addMessage(new HumanMessage("Hi!"));
await memory2.chatHistory.addMessage(new AIMessage("What's up?"));

console.log(await memory2.loadMemoryVariables({}));

const messageMemory = new BufferMemory({
  returnMessages: true,
});

await messageMemory.chatHistory.addMessage(new HumanMessage("Hi!"));
await messageMemory.chatHistory.addMessage(new AIMessage("What's up?"));

console.log(await messageMemory.loadMemoryVariables({}));

import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";

const llm = new OpenAI({ temperature: 0 });

// Notice that a "chat_history" variable is present in the prompt template
const template = `You are a nice chatbot having a conversation with a human.

Previous conversation:
{chat_history}

New human question: {question}
Response:`;
const prompt = PromptTemplate.fromTemplate(template);
// Notice that we need to align the `memoryKey` with the variable in the prompt
const stringPromptMemory = new BufferMemory({ memoryKey: "chat_history" });
const conversationChain = new LLMChain({
  llm,
  prompt,
  verbose: true,
  memory: stringPromptMemory,
});

console.log(await conversationChain.invoke({ question: "What is your name?" }));
console.log(
  await conversationChain.invoke({ question: "What did I just ask you?" })
);

import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

const chatModel = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
const chatPrompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a nice chatbot having a conversation with a human."],
  new MessagesPlaceholder("chat_history"),
  ["human", "{question}"],
]);

const chatPromptMemory = new BufferMemory({
  memoryKey: "chat_history",
  returnMessages: true,
});

const chatConversationChain = new LLMChain({
  llm: chatModel,
  prompt: chatPrompt,
  verbose: true,
  memory: chatPromptMemory,
});

console.log(
  await chatConversationChain.invoke({ question: "What is your name?" })
);
console.log(
  await chatConversationChain.invoke({ question: "What did I just ask you?" })
);
