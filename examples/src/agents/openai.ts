import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";

const tools = [new Calculator(), new SerpAPI()];
const chat = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 });

const executor = await initializeAgentExecutorWithOptions(tools, chat, {
  agentType: "openai-functions",
  verbose: true,
});

const result = await executor.invoke({
  input: "What is the weather in New York?",
});
console.log(result);

/*
  The current weather in New York is 72°F with a wind speed of 1 mph coming from the SSW. The humidity is at 89% and the UV index is 0 out of 11. The cloud cover is 79% and there has been no rain.
*/
