import { AgentExecutor, ZeroShotAgent } from "langchain/agents";
import { LLMChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
  ];

  const prefix = `Answer the following questions as best you can, but speaking as a pirate might speak. You have access to the following tools:`;
  const suffix = `Begin! Remember to speak as a pirate when giving your final answer. Use lots of "Args"

Question: {input}
{agent_scratchpad}`;

  const createPromptArgs = {
    suffix,
    prefix,
    inputVariables: ["input", "agent_scratchpad"],
  };

  const prompt = ZeroShotAgent.createPrompt(tools, createPromptArgs);

  const llmChain = new LLMChain({ llm: model, prompt });
  const agent = new ZeroShotAgent({
    llmChain,
    allowedTools: ["search", "calculator"],
  });
  const agentExecutor = AgentExecutor.fromAgentAndTools({ agent, tools });
  console.log("Loaded agent.");

  const input = `Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?`;

  console.log(`Executing with input "${input}"...`);

  const result = await agentExecutor.invoke({ input });

  console.log(`Got output ${result.output}`);
};
