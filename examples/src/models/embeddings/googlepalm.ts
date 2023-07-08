import { GooglePalmEmbeddings } from "langchain/embeddings/googlepalm";

const model = new GooglePalmEmbeddings();
const res = await model.embedQuery(
  "What would be a good company name for a company that makes colorful socks?"
);
console.log({ res });
