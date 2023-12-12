import { TogetherAI } from "@langchain/community/llms/togetherai";
import { PromptTemplate } from "langchain/prompts";

const model = new TogetherAI({
  modelName: "togethercomputer/StripedHyena-Nous-7B"
});
const prompt = PromptTemplate.fromTemplate(`System: You are a helpful assistant.
User: {input}.
Assistant:`);
const chain = prompt.pipe(model);
const response = await chain.stream({
  input: "What's the capital of France?"
});
for await (const item of response) {
  console.log(item);
}
/**
 * <ADD_RESULT>
 */
