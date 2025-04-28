import { OpenAI } from "@langchain/openai";

export const run = async () => {
  const model = new OpenAI({
    model: "gpt-4",
    temperature: 0.7,
    maxTokens: 1000,
    maxRetries: 5,
  });
  const res = await model.invoke(
    "Question: What would be a good company name a company that makes colorful socks?\nAnswer:"
  );
  console.log({ res });
};
