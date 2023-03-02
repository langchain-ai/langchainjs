import { OpenAI } from "langchain";
import { initializeAgentExecutor } from "langchain/agents";
import {
  Calculator,
  SerpAPI,
} from "langchain/tools";

export const run = async () => {
  const llm = new OpenAI({ temperature: 0 });
  const tools = [new SerpAPI(), new Calculator()];

  const executor = await initializeAgentExecutor({
    tools,
    llm,
    agentType: "zero-shot-react-description",
  });
  console.log("Loaded agent.");

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);

  console.log(
    `Got intermediate steps ${JSON.stringify(
      result.intermediateSteps,
      null,
      2
    )}`
  );
};
