import { ChatMistralAI } from "@langchain/mistralai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";

const calculatorSchema = z.object({
  operation: z
    .enum(["add", "subtract", "multiply", "divide"])
    .describe("The type of operation to execute."),
  number1: z.number().describe("The first number to operate on."),
  number2: z.number().describe("The second number to operate on."),
});

// Extend the StructuredTool class to create a new tool
class CalculatorTool extends StructuredTool {
  name = "calculator";

  description = "A simple calculator tool";

  schema = calculatorSchema;

  async _call(input: z.infer<typeof calculatorSchema>) {
    return JSON.stringify(input);
  }
}

// Or you can convert the tool to a JSON schema using
// a library like zod-to-json-schema
// Uncomment the lines below to use tools this way.
// import { zodToJsonSchema } from "zod-to-json-schema";
// const calculatorJsonSchema = zodToJsonSchema(calculatorSchema);

const model = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  model: "mistral-large-latest",
});

// Bind the tool to the model
const modelWithTool = model.bindTools([new CalculatorTool()]);

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant who always needs to use a calculator.",
  ],
  ["human", "{input}"],
]);

// Define an output parser that can handle tool responses
const outputParser = new JsonOutputKeyToolsParser({
  keyName: "calculator",
  returnSingle: true,
});

// Chain your prompt, model, and output parser together
const chain = prompt.pipe(modelWithTool).pipe(outputParser);

const response = await chain.invoke({
  input: "What is 2 + 2?",
});
console.log(response);
/*
{ operation: 'add', number1: 2, number2: 2 }
 */
