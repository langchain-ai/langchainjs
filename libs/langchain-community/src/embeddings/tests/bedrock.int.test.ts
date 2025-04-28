/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect, test } from "@jest/globals";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { BedrockEmbeddings } from "../bedrock.js";

const getClient = () => {
  if (
    !process.env.BEDROCK_AWS_REGION ||
    !process.env.BEDROCK_AWS_ACCESS_KEY_ID ||
    !process.env.BEDROCK_AWS_SECRET_ACCESS_KEY
  ) {
    throw new Error("Missing environment variables for AWS");
  }

  const client = new BedrockRuntimeClient({
    region: process.env.BEDROCK_AWS_REGION,
    credentials: {
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
    },
  });

  return client;
};

test("Test BedrockEmbeddings.embedQuery", async () => {
  const client = getClient();
  const embeddings = new BedrockEmbeddings({
    maxRetries: 1,
    client,
  });
  const res = await embeddings.embedQuery("Hello world");
  // console.log(res);
  expect(typeof res[0]).toBe("number");
});

test("Test BedrockEmbeddings.embedDocuments with passed region and credentials", async () => {
  const client = getClient();
  const embeddings = new BedrockEmbeddings({
    maxRetries: 1,
    client,
  });
  const res = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
    "we need",
    "at least",
    "six documents",
    "to test pagination",
  ]);
  // console.log(res);
  expect(res).toHaveLength(6);
  res.forEach((r) => {
    expect(typeof r[0]).toBe("number");
  });
});

test("Test end to end with HNSWLib", async () => {
  const client = getClient();
  const vectorStore = await HNSWLib.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new BedrockEmbeddings({
      maxRetries: 1,
      client,
    })
  );
  expect(vectorStore.index?.getCurrentCount()).toBe(3);

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  const resultOneMetadatas = resultOne.map(({ metadata }) => metadata);
  expect(resultOneMetadatas).toEqual([{ id: 2 }]);

  const resultTwo = await vectorStore.similaritySearch("hello world", 2);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([{ id: 2 }, { id: 3 }]);

  const resultThree = await vectorStore.similaritySearch("hello world", 3);
  const resultThreeMetadatas = resultThree.map(({ metadata }) => metadata);
  expect(resultThreeMetadatas).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
});
