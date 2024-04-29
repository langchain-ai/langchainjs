import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { Calculator } from "@langchain/community/tools/calculator";

const tools = [
  new TavilySearchResults({ verbose: true }),
  new Calculator({ verbose: true }),
];
const prompt = await pull<ChatPromptTemplate>("hwchase17/openai-tools-agent");
const llm = new ChatOpenAI({
  model: "gpt-4-1106-preview",
  temperature: 0,
  verbose: false,
});
const agent = await createOpenAIToolsAgent({
  llm,
  tools,
  prompt,
});
const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: false,
});
