import { ChatCohere } from "@langchain/cohere";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const model = new ChatCohere({
  apiKey: process.env.COHERE_API_KEY, // Default
});
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant"],
  ["human", "{input}"],
]);
const chain = prompt.pipe(model);
const response = await chain.invoke({
  input: "Hello there friend!",
});
console.log("response", response);
/*
  response AIMessage {
    content: 'Hello there! How can I help you today?',
    name: undefined,
    additional_kwargs: {
      response_id: '51ff9e7e-7419-43db-a8e6-17db54805695',
      generationId: 'f9b507f5-5296-40c5-834c-b1c09e24a0f6',
      chatHistory: [ [Object], [Object], [Object] ],
      finishReason: 'COMPLETE',
      meta: { apiVersion: [Object], billedUnits: [Object], tokens: [Object] }
    },
    response_metadata: {
      estimatedTokenUsage: { completionTokens: 10, promptTokens: 78, totalTokens: 88 },
      response_id: '51ff9e7e-7419-43db-a8e6-17db54805695',
      generationId: 'f9b507f5-5296-40c5-834c-b1c09e24a0f6',
      chatHistory: [ [Object], [Object], [Object] ],
      finishReason: 'COMPLETE',
      meta: { apiVersion: [Object], billedUnits: [Object], tokens: [Object] }
    },
    id: undefined,
    tool_calls: [],
    invalid_tool_calls: [],
    usage_metadata: { input_tokens: 78, output_tokens: 10, total_tokens: 88 }
  }
*/
