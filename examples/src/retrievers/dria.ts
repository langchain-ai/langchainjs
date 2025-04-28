import { DriaRetriever } from "@langchain/community/retrievers/dria";

// contract of TypeScript Handbook v4.9 uploaded to Dria
// https://dria.co/knowledge/-B64DjhUtCwBdXSpsRytlRQCu-bie-vSTvTIT8Ap3g0
const contractId = "-B64DjhUtCwBdXSpsRytlRQCu-bie-vSTvTIT8Ap3g0";

const retriever = new DriaRetriever({
  contractId, // a knowledge to connect to
  apiKey: "DRIA_API_KEY", // if not provided, will check env for `DRIA_API_KEY`
  topK: 15, // optional: default value is 10
});

const docs = await retriever.invoke("What is a union type?");
console.log(docs);
