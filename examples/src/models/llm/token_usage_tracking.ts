import { OpenAI } from "@langchain/openai";

// Using callbacks to track token usage - useful for chains, agents, or multiple calls
const llm = new OpenAI({
  model: "gpt-3.5-turbo-instruct",
  callbacks: [
    {
      handleLLMEnd(output) {
        // Extract token usage from the callback output
        const tokenUsage = output.llmOutput?.tokenUsage;
        console.log("Token usage from callback:", tokenUsage);
        
        // You can also access the full output if needed
        // console.log("Full output:", JSON.stringify(output, null, 2));
      },
    },
  ],
});

await llm.invoke("Tell me a joke.");

/*
  Token usage from callback: {
    completionTokens: 14,
    promptTokens: 5,
    totalTokens: 19
  }
*/
