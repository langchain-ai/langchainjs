import { Cohere } from "langchain/llms";

export const run = async () => {
  const model = new Cohere({
    temperature: 0.7,
    verbose: true,
    maxConcurrency: 1,
    maxTokens: 20,
    maxRetries: 5,
  });
  const res = await model.call(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log("hello", { res });
};
