import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";

import { pull } from "langchain/hub";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";

// Define the tools the agent will have access to.
const tools = [new DuckDuckGoSearch({ maxResults: 1 })];

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);
const llm = new ChatOpenAI({
  model: "gpt-4-turbo-preview",
  temperature: 0,
});
const agent = await createOpenAIFunctionsAgent({
  llm,
  tools,
  prompt,
});
const agentExecutor = new AgentExecutor({
  agent,
  tools,
});
const result = await agentExecutor.invoke({
  input: "What is Anthropic's estimated revenue for 2024?",
});

console.log(result);
/*
{
  input: "What is Anthropic's estimated revenue for 2024?",
  output: 'Anthropic has projected that it will generate more than $850 million in annualized revenue by the end of 2024. For more details, you can refer to the [Reuters article](https://www.reuters.com/technology/anthropic-forecasts-more-than-850-mln-annualized-revenue-rate-by-2024-end-report-2023-12-26/).'
}
*/
