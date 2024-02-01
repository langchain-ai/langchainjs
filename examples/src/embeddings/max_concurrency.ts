import { OpenAIEmbeddings } from "@langchain/openai";

export const run = async () => {
  const model = new OpenAIEmbeddings({
    maxConcurrency: 1,
  });
  const res = await model.embedQuery(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ res });
};
