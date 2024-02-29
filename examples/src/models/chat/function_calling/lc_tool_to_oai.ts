import { StructuredTool } from '@langchain/core/tools';
import { convertToOpenAITool } from '@langchain/core/utils/function_calling';
import { z } from 'zod';

const calculatorSchema = z
  .object({
    operation: z
      .enum(["add", "subtract", "multiply", "divide"])
      .describe("The type of operation to execute."),
    number1: z.number().describe("The first number to operate on."),
    number2: z.number().describe("The second number to operate on."),
  });

class CalculatorTool extends StructuredTool {
  schema = calculatorSchema;

  name = "calculator";

  description = "A simple calculator tool";

  async _call(params: z.infer<typeof calculatorSchema>) {
    return "The answer";
  }
}

const asOpenAITool = convertToOpenAITool(new CalculatorTool());

console.log(JSON.stringify(asOpenAITool, null, 2));