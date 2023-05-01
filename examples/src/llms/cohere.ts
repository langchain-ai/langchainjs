import { Cohere } from "langchain/llms/cohere";

export const run = async () => {
  const model = new Cohere({
    temperature: 0.7,
    maxTokens: 20,
    maxRetries: 5,
  });
  const res = await model.call(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:"
  );
  console.log({ res });
};
