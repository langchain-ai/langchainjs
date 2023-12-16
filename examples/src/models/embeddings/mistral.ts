import { MistralAIEmbeddings } from "@langchain/mistralai";

/* Embed queries */
const embeddings = new MistralAIEmbeddings({
  apiKey: process.env.MISTRAL_API_KEY,
});
const res = await embeddings.embedQuery("Hello world");
console.log(res);
/* Embed documents */
const documentRes = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
console.log({ documentRes });
