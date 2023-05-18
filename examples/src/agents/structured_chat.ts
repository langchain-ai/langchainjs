import { z } from "zod";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { Calculator } from "langchain/tools/calculator";
import { DynamicStructuredTool } from "langchain/tools";

export const run = async () => {
  const model = new ChatOpenAI({ temperature: 0 });
  const tools = [
    new Calculator(), // Older existing single input tools will still work
    new DynamicStructuredTool({
      name: "random-number-generator",
      description: "generates a random number between two input numbers",
      schema: z.object({
        low: z.number().describe("The lower bound of the generated number"),
        high: z.number().describe("The upper bound of the generated number"),
      }),
      func: async ({ low, high }) =>
        (Math.random() * (high - low) + low).toString(), // Outputs still must be strings
    }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "structured-chat-zero-shot-react-description",
    verbose: true,
  });
  console.log("Loaded agent.");

  const input = `What is a random number between 5 and 10 raised to the second power?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log({ result });

  /*
    {
      "output": "67.95299776074"
    }
  */
};
