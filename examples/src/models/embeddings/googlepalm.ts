import { GooglePaLMEmbeddings } from "langchain/embeddings/googlepalm";

const model = new GooglePaLMEmbeddings({
  apiKey: "<YOUR API KEY>", // or set it in environment variable as `GOOGLE_PALM_API_KEY`
  modelName: "models/embedding-gecko-001", // OPTIONAL
});
/* Embed queries */
const res = await model.embedQuery(
  "What would be a good company name for a company that makes colorful socks?"
);
console.log({ res });
/* Embed documents */
const documentRes = await model.embedDocuments(["Hello world", "Bye bye"]);
console.log({ documentRes });
