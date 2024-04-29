import { TogetherAIEmbeddings } from "@langchain/community/embeddings/togetherai";

const embeddings = new TogetherAIEmbeddings({
  apiKey: process.env.TOGETHER_AI_API_KEY, // Default value
  model: "togethercomputer/m2-bert-80M-8k-retrieval", // Default value
});

const res = await embeddings.embedQuery(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
