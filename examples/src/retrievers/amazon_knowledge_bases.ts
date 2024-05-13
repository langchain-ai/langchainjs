import { AmazonKnowledgeBaseRetriever } from "@langchain/community/retrievers/amazon_knowledge_base";

const retriever = new AmazonKnowledgeBaseRetriever({
  topK: 10,
  knowledgeBaseId: "YOUR_KNOWLEDGE_BASE_ID",
  region: "us-east-2",
  clientOptions: {
    credentials: {
      accessKeyId: "YOUR_ACCESS_KEY_ID",
      secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
    },
  },
});

const docs = await retriever.invoke("How are clouds formed?");

console.log(docs);
