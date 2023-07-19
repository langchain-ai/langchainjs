import { KendraRetriever } from "langchain/retrievers/kendra";

export const run = async () => {
  const retriever = new KendraRetriever({
    topK: 10,
    indexId: "fe5225b6-703c-4700-9be0-f7cd4a37d061",
    region: "us-east-1",
  });

  const docs = await retriever.getRelevantDocuments("How are clouds formed?");

  console.log(docs);
};
