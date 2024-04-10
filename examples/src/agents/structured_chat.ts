import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { AgentExecutor, createStructuredChatAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { ChatOpenAI } from "@langchain/openai";

// Define the tools the agent will have access to.
const tools = [new TavilySearchResults({ maxResults: 1 })];

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/structured-chat-agent
const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/structured-chat-agent"
);

const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0,
});

const agent = await createStructuredChatAgent({
  llm,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
});

const result = await agentExecutor.invoke({
  input: "what is LangChain?",
});

console.log(result);

const result2 = await agentExecutor.invoke({
  input: "what's my name?",
  chat_history: [
    new HumanMessage("hi! my name is cob"),
    new AIMessage("Hello Cob! How can I assist you today?"),
  ],
});

console.log(result2);
