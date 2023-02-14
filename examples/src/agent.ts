import { OpenAI } from "langchain";
import { loadAgent, AgentExecutor } from "langchain/agents";
import { SerpAPI } from "langchain/tools";

export const run = async () => {
  const model = new OpenAI();
  const tools = [SerpAPI()];

  const agent = await loadAgent(
    "lc://agents/zero-shot-react-description/agent.json",
    { llm: model, tools }
  );
  console.log("Loaded agent from Langchain hub");

  const executor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true,
  });

  const input = "Who is Olivia Wilde's boyfriend?" +
    " What is his current age raised to the 0.23 power?";
  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
};
