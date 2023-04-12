import { OpenAI } from "langchain";
import { initializeAgentExecutor } from "langchain/agents";
import { SerpAPI, Calculator, WebBrowser } from "langchain/tools";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const tools = [new SerpAPI(), new Calculator(), new WebBrowser(model)];

  const executor = await initializeAgentExecutor(
    tools,
    model,
    "zero-shot-react-description",
    true
  );
  console.log("Loaded agent.");

  const input = `Whats the word of the day on https://www.merriam-webster.com/word-of-the-day?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${JSON.stringify(result, null, 2)}`);
};
