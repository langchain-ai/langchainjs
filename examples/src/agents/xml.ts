import { ChatAnthropic } from "langchain/chat_models/anthropic";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { SerpAPI } from "langchain/tools";

const model = new ChatAnthropic({ modelName: "claude-2", temperature: 0.1 });
const tools = [new SerpAPI()];

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "xml",
  verbose: true,
});
console.log("Loaded agent.");

const input = `What is the weather in Honolulu?`;

const result = await executor.invoke({ input });

console.log(result);

/*
  https://smith.langchain.com/public/d0acd50a-f99d-4af0-ae66-9009de319fb5/r
  {
    output: 'The weather in Honolulu is currently 75 degrees Fahrenheit with a small craft advisory in effect. The forecast calls for generally clear skies tonight with a low of 75 degrees.'
  }
*/
