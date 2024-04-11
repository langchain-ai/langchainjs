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

// Function for dynamically constructing the end of the chain based on the model-selected tool.
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
    // We use `RunnablePassthrough.assign` here to return the intermediate `toolInvocation` params
    // as well, but you can omit if you only care about the answer.
    return RunnablePassthrough.assign({
      output: toolCallChain,
    });
  }
);

const chain = RunnableSequence.from([
  modelWithTools,
  new JsonOutputToolsParser(),
  // .map() allows us to apply a function for each item in a list of inputs.
  // Required because the model can call multiple tools at once.
  callSelectedTool.map(),
]);

console.log(
  await chain.invoke(
    "What's 23 times 7, and what's five times 18 and add a million plus a billion and cube thirty-seven"
  )
);
