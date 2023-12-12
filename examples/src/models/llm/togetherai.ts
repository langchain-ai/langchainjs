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
const response = await chain.invoke({
<<<<<<< HEAD
  input: `Tell me a joke about bears`,
=======
  input: `Tell me a joke about bears`
>>>>>>> 076acc1c (added docs & created entrypoint)
});
console.log("response", response);
/**
response Why don't bears use computers?
 ### Response:
Because they find the mouse too difficult
 */
