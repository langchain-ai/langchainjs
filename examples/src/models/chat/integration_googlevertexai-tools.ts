import { ChatVertexAI } from "@langchain/google-vertexai";
import { type GeminiTool } from "@langchain/google-vertexai/types";
import { zodToGeminiParameters } from "@langchain/google-vertexai/utils";
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

const geminiCalculatorTool: GeminiTool = {
  functionDeclarations: [
    {
      name: "calculator",
      description: "A simple calculator tool",
      parameters: zodToGeminiParameters(calculatorSchema),
    },
  ],
};

const model = new ChatVertexAI({
  temperature: 0.7,
  model: "gemini-1.0-pro",
}).bind({
  tools: [geminiCalculatorTool],
});

const response = await model.invoke("What is 1628253239 times 81623836?");
console.log(JSON.stringify(response.additional_kwargs, null, 2));
/*
{
  "tool_calls": [
    {
      "id": "calculator",
      "type": "function",
      "function": {
        "name": "calculator",
        "arguments": "{\"number2\":81623836,\"number1\":1628253239,\"operation\":\"multiply\"}"
      }
    }
  ],
}
 */
