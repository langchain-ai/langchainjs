/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { BedrockEmbeddings } from "langchain/embeddings/bedrock";

const embeddings = new BedrockEmbeddings({
  region: process.env.BEDROCK_AWS_REGION!,
  credentials: {
    accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
  },
  model: "amazon.titan-embed-text-v1", // Default value
});

const res = await embeddings.embedQuery(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
