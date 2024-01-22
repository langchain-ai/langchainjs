/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { AmazonKnowledgeBaseRetriever } from "../amazon_knowledge_bases.js";

test("AmazonKnowledgeBaseRetriever", async () => {
  const retriever = new AmazonKnowledgeBaseRetriever({
    topK: 10,
    knowledgeBaseId: "GZ3S9ZLSIM",
    region: "us-east-1",
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

  console.log(docs);
});
