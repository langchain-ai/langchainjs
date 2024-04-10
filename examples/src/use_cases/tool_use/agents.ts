/* eslint-disable import/first */
/* eslint-disable arrow-body-style */

import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

const addTool = new DynamicStructuredTool({
  name: "add",
  description: "Add two integers together.",
  schema: z.object({
    firstInt: z.number(),
    secondInt: z.number(),
  }),
  func: async ({ firstInt, secondInt }) => {
    return (firstInt + secondInt).toString();
  },
});

const multiplyTool = new DynamicStructuredTool({
  name: "multiply",
  description: "Multiply two integers together.",
  schema: z.object({
    firstInt: z.number(),
    secondInt: z.number(),
  }),
  func: async ({ firstInt, secondInt }) => {
    return (firstInt * secondInt).toString();
  },
});

const exponentiateTool = new DynamicStructuredTool({
  name: "exponentiate",
  description: "Exponentiate the base to the exponent power.",
  schema: z.object({
    base: z.number(),
    exponent: z.number(),
  }),
  func: async ({ base, exponent }) => {
    return (base ** exponent).toString();
  },
});

const tools = [addTool, multiplyTool, exponentiateTool];

import { pull } from "langchain/hub";
import type { ChatPromptTemplate } from "@langchain/core/prompts";

// Get the prompt to use - you can modify this!
// You can also see the full prompt at:
// https://smith.langchain.com/hub/hwchase17/openai-tools-agent
const prompt = await pull<ChatPromptTemplate>("hwchase17/openai-tools-agent");

import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
  temperature: 0,
});

const agent = await createOpenAIToolsAgent({
  llm: model,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
});

console.log(
  await agentExecutor.invoke({
    input:
      "Take 3 to the fifth power and multiply that by the sum of twelve and three, then square the whole result",
  })
);
