import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { SessionsPythonREPLTool } from "@langchain/azure-dynamic-sessions";
import { AzureChatOpenAI } from "@langchain/openai";

const tools = [
  new SessionsPythonREPLTool({
    poolManagementEndpoint:
      process.env.AZURE_CONTAINER_APP_SESSION_POOL_MANAGEMENT_ENDPOINT || "",
  }),
];

// Note: you need a model deployment that supports function calling,
// like `gpt-35-turbo` version `1106`.
const llm = new AzureChatOpenAI({
  temperature: 0,
});

// Get the prompt to use - you can modify this!
// If you want to see the prompt in full, you can at:
// https://smith.langchain.com/hub/hwchase17/openai-functions-agent
const prompt = await pull<ChatPromptTemplate>(
  "hwchase17/openai-functions-agent"
);

const agent = await createOpenAIFunctionsAgent({
  llm,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
});

const result = await agentExecutor.invoke({
  input:
    "Create a Python program that prints the Python version and return the result.",
});

console.log(result);
