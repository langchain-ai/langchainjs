import { ChatCohere } from "@langchain/cohere";
import { HumanMessage } from "@langchain/core/messages";
import { convertToCohereTool } from "@langchain/core/utils/function_calling";
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

const model = new ChatCohere({
  apiKey: process.env.COHERE_API_KEY, // Default
});

const magicFunctionTool = new DynamicStructuredTool({
  name: "magic_function",
  description: "Apply a magic function to the input number",
  schema: z.object({
    num: z.number().describe("The number to apply the magic function for"),
  }),
  func: async ({ num }) => {
    return `The magic function of ${num} is ${num + 5}`;
  },
});

const tools = [magicFunctionTool];
const modelWithTools = model.bind({
  tools: tools.map(convertToCohereTool),
});

const messages = [new HumanMessage("What is the magic function of number 5?")];
const response = await modelWithTools.invoke(messages);
/**
response:  AIMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: 'I will use the magic_function tool to answer this question.',
    additional_kwargs: {
      response_id: 'd0b189e5-3dbf-493c-93f8-99ed4b01d96d',
      generationId: '8982a68f-c64c-48f8-bf12-0b4bea0018b6',
      chatHistory: [Array],
      finishReason: 'COMPLETE',
      meta: [Object],
      toolCalls: [Array]
    },
    tool_calls: [ [Object] ],
    usage_metadata: { input_tokens: 920, output_tokens: 54, total_tokens: 974 },
    invalid_tool_calls: [],
    response_metadata: {}
  },
  lc_namespace: [ 'langchain_core', 'messages' ],
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
