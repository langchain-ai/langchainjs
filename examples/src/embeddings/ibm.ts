import { WatsonxEmbeddings } from "@langchain/community/embeddings/ibm";

const instance = new WatsonxEmbeddings({
  version: "YYYY-MM-DD",
  serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
  projectId: process.env.WATSONX_AI_PROJECT_ID,
});

const result = await instance.embedQuery("Hello world!");
console.log(result);
