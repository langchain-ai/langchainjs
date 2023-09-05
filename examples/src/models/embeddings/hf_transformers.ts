import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";

const model = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-MiniLM-L6-v2", // In Node.js defaults to process.env.OPENAI_API_KEY
});

/* Embed queries */
const res = await model.embedQuery(
  "What would be a good company name for a company that makes colorful socks?"
);
console.log({ res });
/* Embed documents */
const documentRes = await model.embedDocuments(["Hello world", "Bye bye"]);
console.log({ documentRes });
