import { z } from "zod";

import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { Calculator } from "@langchain/community/tools/calculator";
// Uncomment this if you're running inside a web/edge environment.
// import { ChatVertexAI } from "@langchain/google-vertexai-web";

const llm: any = new ChatVertexAI({
  temperature: 0,
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
const calculatorTool = new Calculator();

const tools = [currentWeatherTool, calculatorTool];

const agent = await createToolCallingAgent({
  llm,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
});

const input = "What's the weather like in Paris? Also, use a calculator to get the answer to 723639 times 173927.";
const { output } = await agentExecutor.invoke({ input });

console.log(output);

/* 
The weather in Paris is 28 degrees Celsius. Also, 723639 times 173927 is 125860360353.
*/
