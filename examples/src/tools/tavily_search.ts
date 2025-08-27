import { TavilySearch } from "@langchain/tavily";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";

import { pull } from "langchain/hub";
import { createReactAgent } from "langchain";

// Define the tools the agent will have access to.
const tools = [new TavilySearch({ maxResults: 1 })];

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

const agent = await createReactAgent({
  llm,
  tools,
  prompt,
});

const result = await agent.invoke({
  messages: ["what is the weather in wailea?"],
});

console.log(result);

/*
  {
    input: 'what is the weather in wailea?',
    output: "The current weather in Wailea, HI is 64°F with clear skies. The high for today is 82°F and the low is 66°F. If you'd like more detailed information, you can visit [The Weather Channel](https://weather.com/weather/today/l/Wailea+HI?canonicalCityId=ffa9df9f7220c7e22cbcca3dc0a6c402d9c740c755955db833ea32a645b2bcab)."
  }
*/
