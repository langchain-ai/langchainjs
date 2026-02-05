import { ChatCohere } from "@langchain/cohere";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";

const model = new ChatCohere({
  apiKey: process.env.COHERE_API_KEY, // Default
});

const magicFunctionTool = tool(
  async ({ num }) => {
    return `The magic function of ${num} is ${num + 5}`;
  },
  {
    name: "magic_function",
    description: "Apply a magic function to the input number",
    schema: z.object({
      num: z.number().describe("The number to apply the magic function for"),
    }),
  }
);

const tools = [magicFunctionTool];
const modelWithTools = model.bindTools(tools);

const messages = [new HumanMessage("What is the magic function of number 5?")];
const response = await modelWithTools.invoke(messages);

console.log(response);

/*
  AIMessage {
    content: 'I will use the magic_function tool to answer this question.',
    name: undefined,
    additional_kwargs: {
      response_id: 'd0b189e5-3dbf-493c-93f8-99ed4b01d96d',
      generationId: '8982a68f-c64c-48f8-bf12-0b4bea0018b6',
      chatHistory: [ [Object], [Object] ],
      finishReason: 'COMPLETE',
      meta: { apiVersion: [Object], billedUnits: [Object], tokens: [Object] },
      toolCalls: [ [Object] ]
    },
    response_metadata: {
      estimatedTokenUsage: { completionTokens: 54, promptTokens: 920, totalTokens: 974 },
      response_id: 'd0b189e5-3dbf-493c-93f8-99ed4b01d96d',
      generationId: '8982a68f-c64c-48f8-bf12-0b4bea0018b6',
      chatHistory: [ [Object], [Object] ],
      finishReason: 'COMPLETE',
      meta: { apiVersion: [Object], billedUnits: [Object], tokens: [Object] },
      toolCalls: [ [Object] ]
    },
    tool_calls: [
      {
        name: 'magic_function',
        args: [Object],
        id: '4ec98550-ba9a-4043-adfe-566230e5'
      }
    ],
    invalid_tool_calls: [],
    usage_metadata: { input_tokens: 920, output_tokens: 54, total_tokens: 974 }
  }
*/
