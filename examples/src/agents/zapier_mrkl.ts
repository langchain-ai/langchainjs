import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutor, ZapierToolKit } from "langchain/agents";
import { ZapierNLAWrapper } from "langchain/tools";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const zapier = new ZapierNLAWrapper();
  const toolkit = await ZapierToolKit.fromZapierNLAWrapper(zapier);

  const executor = await initializeAgentExecutor(
    toolkit.tools,
    model,
    "zero-shot-react-description",
    true
  );
  console.log("Loaded agent.");

  const input = `Summarize the last email I received regarding Silicon Valley Bank. Send the summary to the #test-zapier Slack channel.`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
};
