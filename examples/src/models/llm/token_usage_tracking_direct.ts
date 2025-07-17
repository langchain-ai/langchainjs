import { OpenAI } from "@langchain/openai";

const llm = new OpenAI({
  model: "gpt-3.5-turbo-instruct",
});

// Use generate() method to get LLMResult with token usage information
const result = await llm.generate(["Tell me a joke."]);

// Access token usage directly from the result
console.log("Token usage:", result.llmOutput?.tokenUsage);

// You can also access individual token counts
const tokenUsage = result.llmOutput?.tokenUsage;
if (tokenUsage) {
  console.log(`Prompt tokens: ${tokenUsage.promptTokens}`);
  console.log(`Completion tokens: ${tokenUsage.completionTokens}`);
  console.log(`Total tokens: ${tokenUsage.totalTokens}`);
}

/*
  Token usage: { completionTokens: 14, promptTokens: 5, totalTokens: 19 }
  Prompt tokens: 5
  Completion tokens: 14
  Total tokens: 19
*/

