import { JinaEmbeddings } from "@langchain/community/embeddings/jina";

const model = new JinaEmbeddings({
  apiKey: process.env.JINA_API_TOKEN,
  model: "jina-embeddings-v2-base-en",
});

const embeddings = await model.embedQuery(
  "Tell me a story about a dragon and a princess."
);

console.log(embeddings);
