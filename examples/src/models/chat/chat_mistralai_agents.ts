import { z } from "zod";

import { ChatMistralAI } from "@langchain/mistralai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";

import { ChatPromptTemplate } from "@langchain/core/prompts";

const llm = new ChatMistralAI({
  temperature: 0,
  model: "mistral-large-latest",
});

// Prompt template must have "input" and "agent_scratchpad input variables"
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

const currentWeatherTool = new DynamicStructuredTool({
  name: "get_current_weather",
  description: "Get the current weather in a given location",
  schema: z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  }),
  func: async () => Promise.resolve("28 °C"),
});

const agent = await createToolCallingAgent({
  llm,
  tools: [currentWeatherTool],
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools: [currentWeatherTool],
});

const input = "What's the weather like in Paris?";
const { output } = await agentExecutor.invoke({ input });

console.log(output);

/* 
  The current weather in Paris is 28 °C.
*/
