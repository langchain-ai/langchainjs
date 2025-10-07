import { DeepInfraEmbeddings } from "@langchain/community/embeddings/deepinfra";

const model = new DeepInfraEmbeddings({
  apiToken: process.env.DEEPINFRA_API_TOKEN,
  batchSize: 1024, // Default value
  modelName: "sentence-transformers/clip-ViT-B-32", // Default value
});

const embeddings = await model.embedQuery(
  "Tell me a story about a dragon and a princess."
);
console.log(embeddings);
