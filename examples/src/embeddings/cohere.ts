import { CohereEmbeddings } from "@langchain/cohere";

export const run = async () => {
  const model = new CohereEmbeddings({ model: "embed-english-v3.0" });
  const res = await model.embedQuery(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ res });
};
