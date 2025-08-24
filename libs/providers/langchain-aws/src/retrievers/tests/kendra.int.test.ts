import { test } from "@jest/globals";
import { AmazonKendraRetriever } from "../kendra.js";

test.skip("AmazonKendraRetriever", async () => {
  if (
    !process.env.BEDROCK_AWS_REGION ||
    !process.env.BEDROCK_AWS_ACCESS_KEY_ID ||
    !process.env.BEDROCK_AWS_SECRET_ACCESS_KEY
  ) {
    throw new Error("Missing environment variables for AWS");
  }

  const retriever = new AmazonKendraRetriever({
    topK: 10,
    indexId: "5c0fcb10-9573-42df-8846-e30d69004ec5",
    region: process.env.BEDROCK_AWS_REGION,
    clientOptions: {
      credentials: {
        accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
      },
    },
  });

  const docs = await retriever.invoke("How are clouds formed?");

  expect(docs.length).toBeGreaterThan(0);

  // console.log(docs);
});
