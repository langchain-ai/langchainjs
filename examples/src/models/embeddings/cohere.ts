import { CohereEmbeddings } from "langchain/embeddings/cohere";

/* Embed queries */
const embeddings = new CohereEmbeddings({
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.COHERE_API_KEY
  batchSize: 48, // Default value if omitted is 48. Max value is 96
});
const res = await embeddings.embedQuery("Hello world");
console.log(res);
/* Embed documents */
const documentRes = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
console.log({ documentRes });
