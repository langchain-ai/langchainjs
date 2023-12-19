import { TogetherAIEmbeddings } from "langchain/embeddings/togetherai";

const embeddings = new TogetherAIEmbeddings({
  apiKey: process.env.TOGETHER_AI_API_KEY,
  model: "TODO_WHAT_ARE_MODEL_NAMES", // Default value
});

const res = await embeddings.embedQuery(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
