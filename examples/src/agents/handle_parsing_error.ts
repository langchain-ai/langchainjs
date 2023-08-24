import { z } from "zod";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicStructuredTool } from "langchain/tools";

const model = new ChatOpenAI({ temperature: 0 });
// Use a schema with an intentionally misleading enum for demonstration purposes
const tools = [
  new DynamicStructuredTool({
    name: "animal-picker",
    description: "Picks animals",
    schema: z.object({
      animal: z
        .object({
          name: z.string().describe("The name of the animal"),
          friendliness: z
            .enum(["earth", "wind", "fire"])
            .describe("How friendly the animal is."),
        })
        .describe("The animal to choose"),
    }),
    func: async (input: { animal: object }) => JSON.stringify(input),
  }),
];

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "openai-functions",
  verbose: true,
  handleParsingErrors:
    "Please try again, paying close attention to the allowed enum values",
});
console.log("Loaded agent.");

const input = `Please choose an aquatic animal and call the provided tool, returning how friendly it is.`;

console.log(`Executing with input "${input}"...`);

const result = await executor.invoke({ input });

console.log({ result });

/*
  { result: { output: 'The dolphin is friendly towards the earth.' } }
*/
