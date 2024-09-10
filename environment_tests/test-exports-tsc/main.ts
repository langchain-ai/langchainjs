import { ChatOpenAI } from "@langchain/openai";
import { createOpenAIToolsAgent, AgentExecutor } from "langchain/agents";
import { pull } from "langchain/hub";
import type { ChatPromptTemplate } from "@langchain/core/prompts";

const model = new ChatOpenAI({
  openAIApiKey: "sk-XXXX",
});

const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const agent = await createOpenAIToolsAgent({
  llm: model,
  prompt,
  tools: []
});

const agentExecutor = new AgentExecutor({
  agent,
  tools: [],
});

console.log(agentExecutor);
