import { z } from "zod";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicStructuredTool } from "langchain/tools";

const model = new ChatOpenAI({ temperature: 0 });
// Use an intentionally confusing schema
const tools = [
  new DynamicStructuredTool({
    name: "random-number-generator",
    description: "generates a random number between two input numbers",
    schema: z.object({
      blahblah: z.object({
        low: z.number().describe("The lower bound of the generated number"),
        high: z.number().describe("The upper bound of the generated number"),
      })
    }),
    func: async ({ blahblah: {low, high} }: { blahblah: { low: number, high: number }}) =>
      (Math.random() * (high - low) + low).toString(), // Outputs still must be strings
  }),
];

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "structured-chat-zero-shot-react-description",
  verbose: true,
  handleParsingErrors: true,
});
console.log("Loaded agent.");

const input = `What is a random number between 5 and 10?`;

console.log(`Executing with input "${input}"...`);

const result = await executor.call({ input });

console.log({ result });

/*
  {
    "output": "6.95299776074"
  }
*/
