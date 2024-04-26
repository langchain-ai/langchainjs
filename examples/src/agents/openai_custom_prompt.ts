import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { ChatOpenAI } from "@langchain/openai";
import { Calculator } from "@langchain/community/tools/calculator";
import { SerpAPI } from "@langchain/community/tools/serpapi";

const tools = [new Calculator(), new SerpAPI()];
const chat = new ChatOpenAI({ model: "gpt-4", temperature: 0 });
const prefix =
  "You are a helpful AI assistant. However, all final response to the user must be in pirate dialect.";

const executor = await initializeAgentExecutorWithOptions(tools, chat, {
  agentType: "openai-functions",
  verbose: true,
  agentArgs: {
    prefix,
  },
});

const result = await executor.invoke({
  input: "What is the weather in New York?",
});
console.log(result);

// Arr matey, in New York, it be feelin' like 75 degrees, with a gentle breeze blowin' from the northwest at 3 knots. The air be 77% full o' water, and the clouds be coverin' 35% of the sky. There be no rain in sight, yarr!
