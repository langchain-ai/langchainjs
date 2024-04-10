import { OpenAI } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import type { PromptTemplate } from "@langchain/core/prompts";

import { pull } from "langchain/hub";
import { AgentExecutor, createReactAgent } from "langchain/agents";

// Define the tools the agent will have access to.
const tools = [new TavilySearchResults({ maxResults: 1 })];

const llm = new OpenAI({
  modelName: "gpt-3.5-turbo-instruct",
  temperature: 0,
});

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/react
const prompt = await pull<PromptTemplate>("hwchase17/react");

const agent = await createReactAgent({
  llm,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
});

// See public LangSmith trace here: https://smith.langchain.com/public/d72cc476-e88f-46fa-b768-76b058586cc1/r
const result = await agentExecutor.invoke({
  input: "what is LangChain?",
});

console.log(result);

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/react-chat
const promptWithChat = await pull<PromptTemplate>("hwchase17/react-chat");

const agentWithChat = await createReactAgent({
  llm,
  tools,
  prompt: promptWithChat,
});

const agentExecutorWithChat = new AgentExecutor({
  agent: agentWithChat,
  tools,
});

const result2 = await agentExecutorWithChat.invoke({
  input: "what's my name?",
  // Notice that chat_history is a string, since this prompt is aimed at LLMs, not chat models
  chat_history: "Human: Hi! My name is Cob\nAI: Hello Cob! Nice to meet you",
});

console.log(result2);
