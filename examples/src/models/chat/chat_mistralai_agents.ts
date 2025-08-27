import { z } from "zod";

import { ChatMistralAI } from "@langchain/mistralai";
import { createReactAgent, HumanMessage, tool } from "langchain";

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

const messages = [new HumanMessage("What's the weather like in Paris?")];
const result = await agent.invoke({ messages });

console.log(result.messages.at(-1)?.content);

/**
 * The current weather in Paris is 28 °C.
 */
