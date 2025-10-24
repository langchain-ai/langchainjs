import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const calculatorSchema = z.object({
  operation: z
    .enum(["add", "subtract", "multiply", "divide"])
    .describe("The type of operation to execute."),
  number1: z.number().describe("The first number to operate on."),
  number2: z.number().describe("The second number to operate on."),
});

const weatherSchema = z.object({
  city: z.string().describe("The city to get the weather from"),
  state: z.string().optional().describe("The state to get the weather from"),
});

const tools = [
  {
    name: "calculator",
    description: "A simple calculator tool",
    input_schema: zodToJsonSchema(calculatorSchema),
  },
  {
    name: "get_weather",
    description:
      "Get the weather of a specific location and return the temperature in Celsius.",
    input_schema: zodToJsonSchema(weatherSchema),
  },
];

const model = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-haiku-20240307",
})
  .bindTools(tools)
  .withConfig({
    tool_choice: {
      type: "tool",
      name: "get_weather",
    },
  });

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant who always needs to use a calculator.",
  ],
  ["human", "{input}"],
]);

// Chain your prompt and model together
const chain = prompt.pipe(model);

const response = await chain.invoke({
  input: "What is the sum of 2725 and 273639",
});
console.log(JSON.stringify(response, null, 2));
/*
{
  "kwargs": {
    "tool_calls": [
      {
        "name": "get_weather",
        "args": {
          "city": "<UNKNOWN>",
          "state": "<UNKNOWN>"
        },
        "id": "toolu_01MGRNudJvSDrrCZcPa2WrBX"
      }
    ],
    "response_metadata": {
      "id": "msg_01RW3R4ctq7q5g4GJuGMmRPR",
      "model": "claude-3-haiku-20240307",
      "stop_sequence": null,
      "usage": {
        "input_tokens": 672,
        "output_tokens": 52
      },
      "stop_reason": "tool_use"
    }
  }
}
*/
