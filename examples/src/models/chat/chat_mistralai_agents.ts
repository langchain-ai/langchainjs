import { z } from "zod";

import { ChatMistralAI } from "@langchain/mistralai";
import { tool } from "@langchain/core/tools";
// @ts-expect-error - createReactAgent is not yet available
import { createReactAgent } from "langchain";

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

// Mocked tool
const currentWeatherTool = tool(async () => "28 °C", {
  name: "get_current_weather",
  description: "Get the current weather in a given location",
  schema: z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  }),
});

const agent = await createReactAgent({
  llm,
  tools: [currentWeatherTool],
  prompt,
});

const input = "What's the weather like in Paris?";
const { output } = await agent.invoke({ input });

console.log(output);

/* 
  The current weather in Paris is 28 °C.
*/
