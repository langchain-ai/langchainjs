import { TogetherAI } from "@langchain/community/llms/togetherai";
import { PromptTemplate } from "langchain/prompts";

const model = new TogetherAI({
<<<<<<< HEAD
  modelName: "togethercomputer/StripedHyena-Nous-7B",
=======
  modelName: "togethercomputer/StripedHyena-Nous-7B"
>>>>>>> 076acc1c (added docs & created entrypoint)
});
const prompt = PromptTemplate.fromTemplate(`System: You are a helpful assistant.
User: {input}.
Assistant:`);
const chain = prompt.pipe(model);
const response = await chain.stream({
<<<<<<< HEAD
  input: "What's the capital of France?",
=======
  input: "What's the capital of France?"
>>>>>>> 076acc1c (added docs & created entrypoint)
});
for await (const item of response) {
  console.log(item);
}
/**
 * <ADD_RESULT>
 */
