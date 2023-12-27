import { CohereEmbeddings } from "@langchain/community/embeddings/cohere";

export const run = async () => {
  const model = new CohereEmbeddings();
  const res = await model.embedQuery(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ res });
};
