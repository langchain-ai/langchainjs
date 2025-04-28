/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { AmazonKnowledgeBaseRetriever } from "../bedrock.js";

test.skip("AmazonKnowledgeBaseRetriever", async () => {
  if (
    !process.env.BEDROCK_AWS_REGION ||
    !process.env.BEDROCK_AWS_ACCESS_KEY_ID ||
    !process.env.BEDROCK_AWS_SECRET_ACCESS_KEY
  ) {
    throw new Error("Missing environment variables for AWS");
  }

  const retriever = new AmazonKnowledgeBaseRetriever({
    topK: 10,
    knowledgeBaseId: process.env.AMAZON_KNOWLEDGE_BASE_ID || "",
    region: process.env.BEDROCK_AWS_REGION,
    overrideSearchType: "HYBRID",
    filter: undefined,
    clientOptions: {
      credentials: {
        accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
        // sessionToken: process.env.AWS_SESSION_TOKEN!,
      },
    },
  });

  const docs = await retriever.invoke("How are clouds formed?");
  expect(docs.length).toBeGreaterThan(0);
});
