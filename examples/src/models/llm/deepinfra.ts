import { DeepInfraLLM } from "@langchain/community/llms/deepinfra";

const apiKey = process.env.DEEPINFRA_API_TOKEN;
const model = "meta-llama/Meta-Llama-3-70B-Instruct";

const llm = new DeepInfraLLM({
  temperature: 0.7,
  maxTokens: 20,
  model,
  apiKey,
  maxRetries: 5,
});

const res = await llm.invoke(
  "What is the next step in the process of making a good game?"
);

console.log({ res });
