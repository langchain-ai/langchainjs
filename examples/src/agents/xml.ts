import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { AgentExecutor, createXmlAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import type { PromptTemplate } from "@langchain/core/prompts";

import { ChatAnthropic } from "@langchain/anthropic";

// Define the tools the agent will have access to.
const tools = [new TavilySearchResults({ maxResults: 1 })];

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/xml-agent-convo
const prompt = await pull<PromptTemplate>("hwchase17/xml-agent-convo");

const llm = new ChatAnthropic({
  modelName: "claude-2.1",
  temperature: 0,
});

const agent = await createXmlAgent({
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
  // Notice that chat_history is a string, since this prompt is aimed at LLMs, not chat models
  chat_history: "Human: Hi! My name is Cob\nAI: Hello Cob! Nice to meet you",
});

console.log(result2);
