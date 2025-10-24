import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  temperature: 0,
  model: "gpt-4o-mini",
});

const calculatorSchema = {
  type: "object",
  properties: {
    operation: {
      type: "string",
      enum: ["add", "subtract", "multiply", "divide"],
    },
    number1: { type: "number" },
    number2: { type: "number" },
  },
  required: ["operation", "number1", "number2"],
};

// Default mode is "functionCalling"
const modelWithStructuredOutput = model.withStructuredOutput(calculatorSchema);

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are VERY bad at math and must always use a calculator.
Respond with a JSON object containing three keys:
'operation': the type of operation to execute, either 'add', 'subtract', 'multiply' or 'divide',
'number1': the first number to operate on,
'number2': the second number to operate on.
`,
  ],
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
 * and raw output in the result, as well as a "name" field
 * to give the LLM additional context as to what you are generating.
 */
const includeRawModel = model.withStructuredOutput(calculatorSchema, {
  name: "calculator",
  includeRaw: true,
  method: "jsonMode",
});

const includeRawChain = prompt.pipe(includeRawModel);
const includeRawResult = await includeRawChain.invoke({});
console.log(JSON.stringify(includeRawResult, null, 2));
/*
{
  "raw": {
    "kwargs": {
      "content": "{\n  \"operation\": \"add\",\n  \"number1\": 2,\n  \"number2\": 2\n}",
      "additional_kwargs": {}
    }
  },
  "parsed": {
    "operation": "add",
    "number1": 2,
    "number2": 2
  }
}
 */
