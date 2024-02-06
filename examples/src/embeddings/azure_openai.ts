import { AzureOpenAIEmbeddings } from "@langchain/azure-openai";

const model = new AzureOpenAIEmbeddings();
const res = await model.embedQuery(
  "What would be a good company name for a company that makes colorful socks?"
);
console.log({ res });
