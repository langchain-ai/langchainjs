import { OpenAI } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import type { PromptTemplate } from "@langchain/core/prompts";

import { pull } from "langchain/hub";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// Define the tools the agent will have access to.
const tools = [new TavilySearchResults({ maxResults: 1 })];

const llm = new OpenAI({
  model: "gpt-3.5-turbo-instruct",
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

// See public LangSmith trace here: https://smith.langchain.com/public/d72cc476-e88f-46fa-b768-76b058586cc1/r
const result = await agent.invoke({
  messages: [new HumanMessage("what is LangChain?")],
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

const result2 = await agentWithChat.invoke({
  messages: [
    new HumanMessage("Hi! My name is Cob"),
    new AIMessage("Hello Cob! Nice to meet you"),
    new HumanMessage("what's my name?"),
  ],
});

console.log(result2);
