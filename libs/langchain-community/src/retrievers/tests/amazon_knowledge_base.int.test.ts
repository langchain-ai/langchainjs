import { test } from "@jest/globals";
import { AmazonKnowledgeBaseRetriever } from "../amazon_knowledge_base.js";

test.skip("AmazonKnowledgeBaseRetriever", async () => {
  const retriever = new AmazonKnowledgeBaseRetriever({
    topK: 10,
    knowledgeBaseId: process.env.AMAZON_KNOWLEDGE_BASE_ID || "",
    region: process.env.AWS_REGION || "us-east-1",
    clientOptions: {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN!,
      },
    },
  });

  const docs = await retriever.getRelevantDocuments("How are clouds formed?");
  expect(docs.length).toBeGreaterThan(0);
});
