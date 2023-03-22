import { OpenAIEmbeddings } from "langchain/embeddings";

export const run = async () => {
  const model = new OpenAIEmbeddings({
    maxConcurrency: 1,
  });
  console.log("yooooo");
  const res = await model.embedQuery(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log("hello", { res });
};
