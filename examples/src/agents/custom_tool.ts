import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { DynamicTool, DynamicStructuredTool } from "langchain/tools";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { pull } from "langchain/hub";

import { z } from "zod";

const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0,
});

const tools = [
  new DynamicTool({
    name: "FOO",
    description:
      "call this to get the value of foo. input should be an empty string.",
    func: async () => "baz",
  }),
  new DynamicStructuredTool({
    name: "random-number-generator",
    description: "generates a random number between two input numbers",
    schema: z.object({
      low: z.number().describe("The lower bound of the generated number"),
      high: z.number().describe("The upper bound of the generated number"),
    }),
    func: async ({ low, high }) =>
      (Math.random() * (high - low) + low).toString(), // Outputs still must be strings
  }),
];

// Get the prompt to use - you can modify this!\
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
  verbose: true,
});

const result = await agentExecutor.invoke({
  input: `What is the value of foo?`,
});

console.log(`Got output ${result.output}`);

/*
  [chain/start] [1:chain:AgentExecutor] Entering Chain run with input: {
    "input": "What is the value of foo?"
  }
  [agent/action] [1:chain:AgentExecutor] Agent selected action: {
    "tool": "FOO",
    "toolInput": {},
    "log": "Invoking \"FOO\" with {}\n",
    "messageLog": [
      {
        "lc": 1,
        "type": "constructor",
        "id": [
          "langchain_core",
          "messages",
          "AIMessage"
        ],
        "kwargs": {
          "content": "",
          "additional_kwargs": {
            "function_call": {
              "name": "FOO",
              "arguments": "{}"
            }
          }
        }
      }
    ]
  }
  [tool/start] [1:chain:AgentExecutor > 8:tool:FOO] Entering Tool run with input: "undefined"
  [tool/end] [1:chain:AgentExecutor > 8:tool:FOO] [113ms] Exiting Tool run with output: "baz"
  [chain/end] [1:chain:AgentExecutor] [3.36s] Exiting Chain run with output: {
    "input": "What is the value of foo?",
    "output": "The value of foo is \"baz\"."
  }
  Got output The value of foo is "baz".
*/

const result2 = await agentExecutor.invoke({
  input: `Generate a random number between 1 and 10.`,
});

console.log(`Got output ${result2.output}`);

/*
  [chain/start] [1:chain:AgentExecutor] Entering Chain run with input: {
    "input": "Generate a random number between 1 and 10."
  }
  [agent/action] [1:chain:AgentExecutor] Agent selected action: {
    "tool": "random-number-generator",
    "toolInput": {
      "low": 1,
      "high": 10
    },
    "log": "Invoking \"random-number-generator\" with {\n  \"low\": 1,\n  \"high\": 10\n}\n",
    "messageLog": [
      {
        "lc": 1,
        "type": "constructor",
        "id": [
          "langchain_core",
          "messages",
          "AIMessage"
        ],
        "kwargs": {
          "content": "",
          "additional_kwargs": {
            "function_call": {
              "name": "random-number-generator",
              "arguments": "{\n  \"low\": 1,\n  \"high\": 10\n}"
            }
          }
        }
      }
    ]
  }
  [tool/start] [1:chain:AgentExecutor > 8:tool:random-number-generator] Entering Tool run with input: "{"low":1,"high":10}"
  [tool/end] [1:chain:AgentExecutor > 8:tool:random-number-generator] [58ms] Exiting Tool run with output: "2.4757639017769293"
  [chain/end] [1:chain:AgentExecutor] [3.32s] Exiting Chain run with output: {
    "input": "Generate a random number between 1 and 10.",
    "output": "The random number generated between 1 and 10 is 2.476."
  }
  Got output The random number generated between 1 and 10 is 2.476.
*/
