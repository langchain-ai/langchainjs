import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq";
import { z } from "zod";

const model = new ChatGroq({
  temperature: 0,
  model: "mixtral-8x7b-32768",
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
console.log(includeRawResult);
/*
  {
    raw: AIMessage {
      content: '',
      additional_kwargs: {
        tool_calls: [
          {
            "id": "call_01htk094ktfgxtkwj40n0ehg61",
            "type": "function",
            "function": {
              "name": "calculator",
              "arguments": "{\"operation\": \"add\", \"number1\": 2, \"number2\": 2}"
            }
          }
        ]
      },
      response_metadata: {
        "tokenUsage": {
          "completionTokens": 197,
          "promptTokens": 1214,
          "totalTokens": 1411
        },
        "finish_reason": "tool_calls"
      }
    },
    parsed: { operation: 'add', number1: 2, number2: 2 }
  }
*/
