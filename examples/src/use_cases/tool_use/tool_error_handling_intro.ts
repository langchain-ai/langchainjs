/* eslint-disable import/first */
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

const complexTool = new DynamicStructuredTool({
  name: "complex_tool",
  description: "Do something complex with a complex tool.",
  schema: z.object({
    intArg: z.number(),
    floatArg: z.number(),
    dictArg: z.object({}),
  }),
  func: async ({ intArg, floatArg, dictArg }) => {
    // Unused for demo purposes
    console.log(dictArg);
    return (intArg * floatArg).toString();
  },
});

import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
});

import { convertToOpenAITool } from "@langchain/core/utils/function_calling";

const formattedTools = [convertToOpenAITool(complexTool)];

const modelWithTools = model.bind({
  tools: formattedTools,
  // We specify tool_choice to enforce that the 'multiply' function is called by the model.
  tool_choice: {
    type: "function",
    function: { name: "complex_tool" },
  },
});

import { JsonOutputKeyToolsParser } from "langchain/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

const chain = RunnableSequence.from([
  modelWithTools,
  new JsonOutputKeyToolsParser({ keyName: "complex_tool", returnSingle: true }),
  complexTool,
]);

console.log(
  await chain.invoke("use complex tool. the args are 5, 2.1, potato.")
);
