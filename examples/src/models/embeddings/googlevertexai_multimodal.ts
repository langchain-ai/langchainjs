import fs from "fs";
import { GoogleVertexAIMultimodalEmbeddings } from "langchain/experimental/multimodal_embeddings/googlevertexai";

const model = new GoogleVertexAIMultimodalEmbeddings();

// Load the image into a buffer to get the embedding of it
const img = fs.readFileSync("/path/to/file.jpg");
const imgEmbedding = await model.embedImageQuery(img);
console.log({ imgEmbedding });

// You can also get text embeddings
const textEmbedding = await model.embedQuery(
  "What would be a good company name for a company that makes colorful socks?"
);
console.log({ textEmbedding });
