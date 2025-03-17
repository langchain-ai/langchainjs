import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const model = new ChatOpenAI({
  temperature: 0,
  model: "gpt-4o-mini",
});

const calculatorSchema = z.object({
  operation: z.enum(["add", "subtract", "multiply", "divide"]),
  number1: z.number(),
  number2: z.number(),
});

const modelWithStructuredOutput = model.withStructuredOutput(calculatorSchema);

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are VERY bad at math and must always use a calculator."],
  ["human", "Please help me!! What is 2 + 2?"],
]);
const chain = prompt.pipe(modelWithStructuredOutput);
const result = await chain.invoke({});
console.log(result);
/*
{ operation: 'add', number1: 2, number2: 2 }
 */

/**
 * You can also specify 'includeRaw' to return the parsed
 * and raw output in the result.
 */
const includeRawModel = model.withStructuredOutput(calculatorSchema, {
  name: "calculator",
  includeRaw: true,
});

const includeRawChain = prompt.pipe(includeRawModel);
const includeRawResult = await includeRawChain.invoke({});
console.log(JSON.stringify(includeRawResult, null, 2));
/*
{
  "raw": {
    "kwargs": {
      "content": "",
      "additional_kwargs": {
        "tool_calls": [
          {
            "id": "call_A8yzNBDMiRrCB8dFYqJLhYW7",
            "type": "function",
            "function": {
              "name": "calculator",
              "arguments": "{\"operation\":\"add\",\"number1\":2,\"number2\":2}"
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
