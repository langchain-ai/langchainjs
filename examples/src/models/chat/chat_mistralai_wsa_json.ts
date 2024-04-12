import { ChatMistralAI } from "@langchain/mistralai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const calculatorJsonSchema = {
  type: "object",
  properties: {
    operation: {
      type: "string",
      enum: ["add", "subtract", "multiply", "divide"],
      description: "The type of operation to execute.",
    },
    number1: { type: "number", description: "The first number to operate on." },
    number2: {
      type: "number",
      description: "The second number to operate on.",
    },
  },
  required: ["operation", "number1", "number2"],
  description: "A simple calculator tool",
};

const model = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY,
  model: "mistral-large",
});

// Pass the schema and tool name to the withStructuredOutput method
const modelWithTool = model.withStructuredOutput(calculatorJsonSchema);

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
