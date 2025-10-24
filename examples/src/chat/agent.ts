import { AgentExecutor, createReactAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import type { PromptTemplate } from "@langchain/core/prompts";

import { OpenAI } from "@langchain/openai";

import { SerpAPI } from "@langchain/community/tools/serpapi";

export const run = async () => {
  // Define the tools the agent will have access to.
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
  ];

  // Get the prompt to use - you can modify this!
  // If you want to see the prompt in full, you can at:
  // https://smith.langchain.com/hub/hwchase17/react
  const prompt = await pull<PromptTemplate>("hwchase17/react");

  const llm = new OpenAI({
    temperature: 0,
  });

  const agent = await createReactAgent({
    llm,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  const result = await agentExecutor.invoke({
    input: "what is LangChain?",
  });

  console.log(result);
};
