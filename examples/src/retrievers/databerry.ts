import { DataberryRetriever } from "langchain/retrievers/databerry";

export const run = async () => {
  const retriever = new DataberryRetriever({
    datastoreUrl: "https://api.databerry.ai/query/clg1xg2h80000l708dymr0fxc",
    apiKey: "DATABERRY_API_KEY", // optional: needed for private datastores
    topK: 8, // optional: default value is 3
  });

  const docs = await retriever.getRelevantDocuments("hello");

  console.log(docs);
};
