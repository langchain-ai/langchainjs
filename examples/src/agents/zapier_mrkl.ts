import { OpenAI } from "langchain/llms/openai";
import { ZapierNLAWrapper } from "langchain/tools";
import {
  initializeAgentExecutorWithOptions,
  ZapierToolKit,
} from "langchain/agents";

const model = new OpenAI({ temperature: 0 });
const zapier = new ZapierNLAWrapper();
const toolkit = await ZapierToolKit.fromZapierNLAWrapper(zapier);

const executor = await initializeAgentExecutorWithOptions(
  toolkit.tools,
  model,
  {
    agentType: "zero-shot-react-description",
    verbose: true,
  }
);
console.log("Loaded agent.");

const input = `Summarize the last email I received regarding Silicon Valley Bank. Send the summary to the #test-zapier Slack channel.`;

console.log(`Executing with input "${input}"...`);

const result = await executor.invoke({ input });

console.log(`Got output ${result.output}`);
