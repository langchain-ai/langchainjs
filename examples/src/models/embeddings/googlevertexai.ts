import { GoogleVertexAIEmbeddings } from "@langchain/community/embeddings/googlevertexai";

export const run = async () => {
  const model = new GoogleVertexAIEmbeddings();
  const res = await model.embedQuery(
    "What would be a good company name for a company that makes colorful socks?"
  );
  console.log({ res });
};
