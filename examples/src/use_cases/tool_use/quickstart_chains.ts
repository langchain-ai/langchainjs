/* eslint-disable import/first */
/* eslint-disable arrow-body-style */

import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

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

console.log(await multiplyTool.invoke({ firstInt: 4, secondInt: 5 }));

import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo-1106",
});

import { convertToOpenAITool } from "@langchain/core/utils/function_calling";

const formattedTools = [convertToOpenAITool(multiplyTool)];

console.log(JSON.stringify(formattedTools, null, 2));

const modelWithTools = model.bind({
  tools: formattedTools,
  // We specify tool_choice to enforce that the 'multiply' function is called by the model.
  tool_choice: {
    type: "function",
    function: { name: "multiply" },
  },
});

import {
  JsonOutputToolsParser,
  JsonOutputKeyToolsParser,
} from "langchain/output_parsers";

const chain = modelWithTools.pipe(new JsonOutputToolsParser());

console.log(await chain.invoke("What's 4 times 23?"));

const chain2 = modelWithTools.pipe(
  new JsonOutputKeyToolsParser({ keyName: "multiply", returnSingle: true })
);

console.log(await chain2.invoke("What's 4 times 23?"));

import { RunnableSequence } from "@langchain/core/runnables";

const chain3 = RunnableSequence.from([
  modelWithTools,
  new JsonOutputKeyToolsParser({ keyName: "multiply", returnSingle: true }),
  multiplyTool,
]);

console.log(await chain3.invoke("What's 4 times 23?"));
