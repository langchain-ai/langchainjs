/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { AmazonKendraRetriever } from "../amazon_kendra.js";

test.skip("AmazonKendraRetriever", async () => {
  const retriever = new AmazonKendraRetriever({
    topK: 10,
    indexId: "5c0fcb10-9573-42df-8846-e30d69004ec5",
    region: "us-east-2",
    clientOptions: {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    },
  });

  const docs = await retriever.getRelevantDocuments("How are clouds formed?");

  console.log(docs);
});
