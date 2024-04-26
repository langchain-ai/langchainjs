import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";

const model = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

/* Embed queries */
const res = await model.embedQuery(
  "What would be a good company name for a company that makes colorful socks?"
);
console.log({ res });
/* Embed documents */
const documentRes = await model.embedDocuments(["Hello world", "Bye bye"]);
console.log({ documentRes });
