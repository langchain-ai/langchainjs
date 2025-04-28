/* eslint-disable @typescript-eslint/no-non-null-assertion */
import Metal from "@getmetal/metal-sdk";
import { MetalRetriever } from "@langchain/community/retrievers/metal";

export const run = async () => {
  const MetalSDK = Metal;

  const client = new MetalSDK(
    process.env.METAL_API_KEY!,
    process.env.METAL_CLIENT_ID!,
    process.env.METAL_INDEX_ID
  );
  const retriever = new MetalRetriever({ client });

  const docs = await retriever.invoke("hello");

  console.log(docs);
};
