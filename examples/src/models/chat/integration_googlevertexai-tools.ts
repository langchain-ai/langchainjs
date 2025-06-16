import { ChatVertexAI } from "@langchain/google-vertexai";
import { type GeminiTool } from "@langchain/google-vertexai/types";
import { schemaToGeminiParameters } from "@langchain/google-vertexai/utils";
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
      parameters: schemaToGeminiParameters(calculatorSchema),
    },
  ],
};

const model = new ChatVertexAI({
  temperature: 0.7,
  model: "gemini-1.5-flash-001",
}).bindTools([geminiCalculatorTool]);

const response = await model.invoke("What is 1628253239 times 81623836?");
console.log(JSON.stringify(response.additional_kwargs, null, 2));
/*
{
  "tool_calls": [
    {
      "id": "a20075d3b0e34f7ca60cc135916e620d",
      "type": "function",
      "function": {
        "name": "calculator",
        "arguments": "{\"number1\":1628253239,\"operation\":\"multiply\",\"number2\":81623836}"
      }
    }
  ]
}
 */
