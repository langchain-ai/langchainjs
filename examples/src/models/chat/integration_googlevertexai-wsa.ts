import { ChatVertexAI } from "@langchain/google-vertexai";
import { z } from "zod";
// Or, if using the web entrypoint:
// import { ChatVertexAI } from "@langchain/google-vertexai-web";

const calculatorSchema = z.object({
  operation: z
    .enum(["add", "subtract", "multiply", "divide"])
    .describe("The type of operation to execute"),
  number1: z.number().describe("The first number to operate on."),
  number2: z.number().describe("The second number to operate on."),
});

const model = new ChatVertexAI({
  temperature: 0.7,
  model: "gemini-1.0-pro",
}).withStructuredOutput(calculatorSchema);

const response = await model.invoke("What is 1628253239 times 81623836?");
console.log(response);
/*
{ operation: 'multiply', number1: 1628253239, number2: 81623836 }
 */
