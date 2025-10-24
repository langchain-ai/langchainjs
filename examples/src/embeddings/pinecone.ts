import { PineconeEmbeddings } from "@langchain/pinecone";

export const run = async () => {
  const model = new PineconeEmbeddings();
  console.log({ model }); // Prints out model metadata
  const res = await model.embedQuery(
    "What would be a good company name a company that makes colorful socks?"
  );
  console.log({ res });
};

await run();
