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

import { ChatOpenAI } from "@langchain/openai";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import {
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
});

const tools = [multiplyTool, exponentiateTool, addTool];

const toolMap: Record<string, any> = {
  multiply: multiplyTool,
  exponentiate: exponentiateTool,
  add: addTool,
};

const modelWithTools = model.bind({
  tools: tools.map(convertToOpenAITool),
});

const callSelectedTool = RunnableLambda.from(
  (toolInvocation: Record<string, any>) => {
    const selectedTool = toolMap[toolInvocation.type];
    if (!selectedTool) {
      throw new Error(
        `No matching tool available for requested type "${toolInvocation.type}".`
      );
    }
    const toolCallChain = RunnableSequence.from([
      (toolInvocation) => toolInvocation.args,
      selectedTool,
    ]);
    return RunnablePassthrough.assign({
      output: toolCallChain,
    });
  }
);

const chain = RunnableSequence.from([
  modelWithTools,
  new JsonOutputToolsParser(),
  callSelectedTool.map(),
]);

console.log(await chain.invoke("What's 23 times 7"));

console.log(await chain.invoke("add a million plus a billion"));

console.log(await chain.invoke("cube thirty-seven"));
