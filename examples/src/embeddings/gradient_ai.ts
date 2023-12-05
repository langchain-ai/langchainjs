import { GradientEmbeddings } from "langchain/embeddings/gradient_ai";

const model = new GradientEmbeddings({});
const res = await model.embedQuery(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
