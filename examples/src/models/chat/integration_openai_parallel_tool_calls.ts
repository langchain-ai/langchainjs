import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const model = new ChatOpenAI({
  temperature: 0,
  model: "gpt-4o-mini",
});

// Define your tools
const calculatorSchema = z
  .object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  })
  .describe("A tool to perform basic arithmetic operations");
const weatherSchema = z
  .object({
    city: z.string(),
  })
  .describe("A tool to get the weather in a city");

// Bind tools to the model
const modelWithTools = model.bindTools([
  {
    type: "function",
    function: {
      name: "calculator",
      description: calculatorSchema.description,
      parameters: zodToJsonSchema(calculatorSchema),
    },
  },
  {
    type: "function",
    function: {
      name: "weather",
      description: weatherSchema.description,
      parameters: zodToJsonSchema(weatherSchema),
    },
  },
]);

// Invoke the model with `parallel_tool_calls` set to `true`
const response = await modelWithTools.invoke(
  ["What is the weather in san francisco and what is 23716 times 27342?"],
  {
    parallel_tool_calls: true,
  }
);
console.log(response.tool_calls);
// We can see it called two tools
/*
[
  {
    name: 'weather',
    args: { city: 'san francisco' },
    id: 'call_c1KymEIix7mdlFtgLSnTXmDc'
  },
  {
    name: 'calculator',
    args: { operation: 'multiply', number1: 23716, number2: 27342 },
    id: 'call_ANLYclAmXQ4TwUCLXakbPr3Z'
  }
]
*/

// Invoke the model with `parallel_tool_calls` set to `false`
const response2 = await modelWithTools.invoke(
  ["What is the weather in san francisco and what is 23716 times 27342?"],
  {
    parallel_tool_calls: false,
  }
);
console.log(response2.tool_calls);
// We can see it called one tool
/*
[
  {
    name: 'weather',
    args: { city: 'san francisco' },
    id: 'call_Rk34XffawJjgZ2BCK9E4CwlT'
  }
]
*/
