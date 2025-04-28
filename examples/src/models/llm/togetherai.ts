import { TogetherAI } from "@langchain/community/llms/togetherai";
import { PromptTemplate } from "@langchain/core/prompts";

const model = new TogetherAI({
  model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
});
const prompt = PromptTemplate.fromTemplate(`System: You are a helpful assistant.
User: {input}.
Assistant:`);
const chain = prompt.pipe(model);
const response = await chain.invoke({
  input: `Tell me a joke about bears`,
});
console.log("response", response);
/**
response Sure, here's a bear joke for you: Why do bears hate shoes so much? Because they like to run around in their bear feet!
 */
