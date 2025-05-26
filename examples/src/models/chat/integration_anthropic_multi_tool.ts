import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const calculatorSchema = z.object({
  operation: z
    .enum(["add", "subtract", "multiply", "divide", "average"])
    .describe("The type of operation to execute."),
  numbers: z.array(z.number()).describe("The numbers to operate on."),
});

const weatherSchema = z
  .object({
    location: z.string().describe("The name of city to get the weather for."),
  })
  .describe(
    "Get the weather of a specific location and return the temperature in Celsius."
  );

const tools = [
  {
    name: "calculator",
    description: "A simple calculator tool.",
    input_schema: zodToJsonSchema(calculatorSchema),
  },
  {
    name: "get_weather",
    description: "Get the weather of a location",
    input_schema: zodToJsonSchema(weatherSchema),
  },
];

const model = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-opus-20240229",
}).bindTools(tools);

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant who always uses tools to ensure you provide accurate, up to date information.",
  ],
  ["human", "{input}"],
]);

// Chain your prompt and model together
const chain = prompt.pipe(model);

const response = await chain.invoke({
  input:
    "What is the current weather in new york, and san francisco? Also, what is the average of these numbers: 2273,7192,272,92737?",
});
console.log(JSON.stringify(response, null, 2));
/*
{
  "kwargs": {
    "content": "<thinking>\nTo answer this query, there are two relevant tools:\n\n1. get_weather - This can be used to get the current weather for New York and San Francisco. It requires a \"location\" parameter. Since the user provided \"new york\" and \"san francisco\" as locations, we have the necessary information to call this tool twice - once for each city.\n\n2. calculator - This can be used to calculate the average of the provided numbers. It requires a \"numbers\" parameter which is an array of numbers, and an \"operation\" parameter. The user provided the numbers \"2273,7192,272,92737\" which we can split into an array, and they asked for the \"average\", so we have the necessary information to call this tool.\n\nSince we have the required parameters for both relevant tools, we can proceed with the function calls.\n</thinking>",
    "additional_kwargs": {
      "id": "msg_013AgVS83LU6fWRHbykfvbYS",
      "type": "message",
      "role": "assistant",
      "model": "claude-3-opus-20240229",
      "stop_reason": "tool_use",
      "usage": {
        "input_tokens": 714,
        "output_tokens": 336
      },
      "tool_calls": [
        {
          "id": "toolu_01NHY2v7kZx8WqAvGzBuCu4h",
          "type": "function",
          "function": {
            "arguments": "{\"location\":\"new york\"}",
            "name": "get_weather"
          }
        },
        {
          "id": "toolu_01PVCofvgkbnD4NfWfvXdsPC",
          "type": "function",
          "function": {
            "arguments": "{\"location\":\"san francisco\"}",
            "name": "get_weather"
          }
        },
        {
          "id": "toolu_019AVVNUyCYnvsVdpkGKVDdv",
          "type": "function",
          "function": {
            "arguments": "{\"operation\":\"average\",\"numbers\":[2273,7192,272,92737]}",
            "name": "calculator"
          }
        }
      ]
    },
  }
}
*/
