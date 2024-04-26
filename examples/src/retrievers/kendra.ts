import { AmazonKendraRetriever } from "@langchain/community/retrievers/amazon_kendra";

const retriever = new AmazonKendraRetriever({
  topK: 10,
  indexId: "YOUR_INDEX_ID",
  region: "us-east-2", // Your region
  clientOptions: {
    credentials: {
      accessKeyId: "YOUR_ACCESS_KEY_ID",
      secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
    },
  },
});

const docs = await retriever.invoke("How are clouds formed?");

console.log(docs);
