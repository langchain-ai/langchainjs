import { z } from "zod";

import { ChatAnthropic } from "@langchain/anthropic";
import { createReactAgent, tool, HumanMessage } from "langchain";

import { ChatPromptTemplate } from "@langchain/core/prompts";

const llm = new ChatAnthropic({
  model: "claude-3-sonnet-20240229",
  temperature: 0,
});

// Prompt template must have "input" and "agent_scratchpad input variables"
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

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

const messages = [new HumanMessage("What's the weather like in SF?")];
const result = await agent.invoke({ messages });

console.log(result.messages.at(-1)?.content);

/**
 * The current weather in San Francisco, CA is 28°C.
 */
