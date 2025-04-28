import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { Calculator } from "@langchain/community/tools/calculator";

const tools = [
  new TavilySearchResults({ verbose: true }),
  new Calculator({ verbose: true }),
];

// Prompt template must have "input" and "agent_scratchpad input variables
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

const llm = new ChatAnthropic({
  model: "claude-3-sonnet-20240229",
  temperature: 0,
  verbose: false,
});

const agent = await createToolCallingAgent({
  llm,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: false,
});

const result = await agentExecutor.invoke({
  input:
    "Who directed the 2023 film Oppenheimer and what is their age? What is their age in days (assume 365 days per year)?",
});

console.log(result);
