import { LunaryHandler } from "@langchain/community/callbacks/handlers/lunary";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { ChatOpenAI } from "@langchain/openai";

import { Calculator } from "@langchain/community/tools/calculator";

const tools = [new Calculator()];
const chat = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
  callbacks: [new LunaryHandler()],
});

const executor = await initializeAgentExecutorWithOptions(tools, chat, {
  agentType: "openai-functions",
});

const result = await executor.run(
  "What is the approximate result of 78 to the power of 5?",
  {
    callbacks: [new LunaryHandler()],
    metadata: { agentName: "SuperCalculator" },
  }
);
