import { ChatTogetherAI } from "@langchain/together-ai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v3";

const calculatorTool = tool(
  async ({ expression }) => {
    return `${Function(`"use strict"; return (${expression});`)()}`;
  },
  {
    name: "calculator",
    description: "Evaluate a basic arithmetic expression.",
    schema: z.object({
      expression: z.string().describe("An arithmetic expression to evaluate."),
    }),
  }
);

const modelWithCalculator = new ChatTogetherAI({
  temperature: 0,
  // This is the default env variable name it will look for if none is passed.
  apiKey: process.env.TOGETHER_AI_API_KEY,
  // Together JSON mode/tool calling only supports a select number of models
  model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
})
  // Bind the tool to the model.
  .bindTools([calculatorTool])
  .withConfig({
    // Specify what tool the model should use
    tool_choice: "calculator",
  });

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a super not-so-smart mathmatician."],
  ["human", "Help me out, how can I add {math}?"],
]);

// Use LCEL to chain the prompt to the model.
const response = await prompt.pipe(modelWithCalculator).invoke({
  math: "2 plus 3",
});

console.log(JSON.stringify(response.additional_kwargs.tool_calls));
/**
[
  {
    "id": "call_f4lzeeuho939vs4dilwd7267",
    "type":"function",
    "function": {
      "name":"calculator",
      "arguments": "{\"input\":\"2 + 3\"}"
    }
  }
]
 */
