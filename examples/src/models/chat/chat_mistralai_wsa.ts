import { ChatMistralAI } from "@langchain/mistralai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

const calculatorSchema = z
  .object({
    operation: z
      .enum(["add", "subtract", "multiply", "divide"])
      .describe("The type of operation to execute."),
    number1: z.number().describe("The first number to operate on."),
    number2: z.number().describe("The second number to operate on."),
  })
  .describe("A simple calculator tool");

const model = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  model: "mistral-large",
});

// Pass the schema and tool name to the withStructuredOutput method
const modelWithTool = model.withStructuredOutput(calculatorSchema);

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant who always needs to use a calculator.",
  ],
  ["human", "{input}"],
]);

// Chain your prompt and model together
const chain = prompt.pipe(modelWithTool);

const response = await chain.invoke({
  input: "What is 2 + 2?",
});
console.log(response);
/*
  { operation: 'add', number1: 2, number2: 2 }
*/

/**
 * You can supply a "name" field to give the LLM additional context
 * around what you are trying to generate. You can also pass
 * 'includeRaw' to get the raw message back from the model too.
 */
const includeRawModel = model.withStructuredOutput(calculatorSchema, {
  name: "calculator",
  includeRaw: true,
});
const includeRawChain = prompt.pipe(includeRawModel);

const includeRawResponse = await includeRawChain.invoke({
  input: "What is 2 + 2?",
});
console.log(JSON.stringify(includeRawResponse, null, 2));
/*
  {
    "raw": {
      "kwargs": {
        "content": "",
        "additional_kwargs": {
          "tool_calls": [
            {
              "id": "null",
              "type": "function",
              "function": {
                "name": "calculator",
                "arguments": "{\"operation\": \"add\", \"number1\": 2, \"number2\": 2}"
              }
            }
          ]
        }
      }
    },
    "parsed": {
      "operation": "add",
      "number1": 2,
      "number2": 2
    }
  }
*/
