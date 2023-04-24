import { OpenAI } from "langchain/llms/openai";

export const run = async () => {
  const model = new OpenAI({
    modelName: "gpt-4",
    temperature: 0.7,
    maxTokens: 1000,
    maxRetries: 5,
  });
  const res = await model.call(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:"
  );
  console.log({ res });
};
