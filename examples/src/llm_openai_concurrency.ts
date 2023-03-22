import { OpenAI } from "langchain/llms";

export const run = async () => {
  const model = new OpenAI({
    modelName: "gpt-4",
    temperature: 0.7,
    verbose: true,
    maxConcurrency: 1,
    maxTokens: 1000,
    maxRetries: 5,
  });
  const res = await model.call(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log("hello", { res });
};
