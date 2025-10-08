import { NomicEmbeddings } from "@langchain/nomic";

/* Embed queries */
const nomicEmbeddings = new NomicEmbeddings();
const res = await nomicEmbeddings.embedQuery("Hello world");
console.log(res);
/* Embed documents */
const documentRes = await nomicEmbeddings.embedDocuments([
  "Hello world",
  "Bye bye",
]);
console.log(documentRes);
