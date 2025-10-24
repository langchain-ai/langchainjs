import { ExaSearchResults } from "@langchain/exa";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import Exa from "exa-js";
import { pull } from "langchain/hub";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";

// Define the tools the agent will have access to.
const tools = [
  new ExaSearchResults({
    // @ts-expect-error Some TS Config's will cause this to give a TypeScript error, even though it works.
    client: new Exa(process.env.EXASEARCH_API_KEY),
  }),
];

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const llm = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
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
  input: "what is the weather in wailea?",
});

console.log(result);

/*
{
  input: 'what is the weather in wailea?',
  output: 'I found a weather forecast for Wailea-Makena on Windfinder.com. You can check the forecast [here](https://www.windfinder.com/forecast/wailea-makena).'
}
*/
