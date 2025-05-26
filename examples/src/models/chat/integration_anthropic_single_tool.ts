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

const tool = {
  name: "calculator",
  description: "A simple calculator tool",
  input_schema: zodToJsonSchema(calculatorSchema),
};

const model = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-haiku-20240307",
}).bindTools([tool]);

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
  input: "What is 2 + 2?",
});
console.log(JSON.stringify(response, null, 2));
/*
{
  "kwargs": {
    "content": "Okay, let's calculate that using the calculator tool:",
    "additional_kwargs": {
      "id": "msg_01YcT1KFV8qH7xG6T6C4EpGq",
      "role": "assistant",
      "model": "claude-3-haiku-20240307",
      "tool_calls": [
        {
          "id": "toolu_01UiqGsTTH45MUveRQfzf7KH",
          "type": "function",
          "function": {
            "arguments": "{\"number1\":2,\"number2\":2,\"operation\":\"add\"}",
            "name": "calculator"
          }
        }
      ]
    },
    "response_metadata": {}
  }
}
*/
