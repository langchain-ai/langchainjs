import { PremEmbeddings } from "@langchain/community/embeddings/premai";

const embeddings = new PremEmbeddings({
  // In Node.js defaults to process.env.PREM_API_KEY
  apiKey: "YOUR-API-KEY",
  // In Node.js defaults to process.env.PREM_PROJECT_ID
  project_id: "YOUR-PROJECT_ID",
  model: "@cf/baai/bge-small-en-v1.5", // The model to generate the embeddings
});

const res = await embeddings.embedQuery(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
