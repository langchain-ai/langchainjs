import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large",
});

const vectors = await embeddings.embedDocuments(["some text"]);
console.log(vectors[0].length);

const embeddings1024 = new OpenAIEmbeddings({
  model: "text-embedding-3-large",
  dimensions: 1024,
});

const vectors2 = await embeddings1024.embedDocuments(["some text"]);
console.log(vectors2[0].length);
