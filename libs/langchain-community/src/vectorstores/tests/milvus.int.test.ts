import { test, expect, afterAll, beforeAll } from "@jest/globals";
import { ErrorCode, MilvusClient } from "@zilliz/milvus2-sdk-node";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { Milvus } from "../milvus.js";

let collectionName: string;
let embeddings: OpenAIEmbeddings;
// https://docs.zilliz.com/docs/quick-start-1#create-a-collection
const MILVUS_ADDRESS = "";
const MILVUS_TOKEN = "";

const OPEN_AI_API_KEY = "";

beforeAll(async () => {
  embeddings = new OpenAIEmbeddings({
    openAIApiKey: OPEN_AI_API_KEY,
  });
  collectionName = `test_collection_${Math.random().toString(36).substring(7)}`;
});

test.skip("Test Milvus.fromtext with token", async () => {
  const texts = [
    `Tortoise: Labyrinth? Labyrinth? Could it Are we in the notorious Little
Harmonic Labyrinth of the dreaded Majotaur?`,
    "Achilles: Yiikes! What is that?",
    `Tortoise: They say-although I person never believed it myself-that an I
    Majotaur has created a tiny labyrinth sits in a pit in the middle of
    it, waiting innocent victims to get lost in its fears complexity.
    Then, when they wander and dazed into the center, he laughs and
    laughs at them-so hard, that he laughs them to death!`,
    "Achilles: Oh, no!",
    "Tortoise: But it's only a myth. Courage, Achilles.",
  ];
  const objA = { A: { B: "some string" } };
  const objB = { A: { B: "some other string" } };
  const metadatas: object[] = [
    { id: 2, other: objA },
    { id: 1, other: objB },
    { id: 3, other: objA },
    { id: 4, other: objB },
    { id: 5, other: objA },
  ];
  const milvus = await Milvus.fromTexts(texts, metadatas, embeddings, {
    collectionName,
    autoId: false,
    primaryField: "id",
    clientConfig: {
      address: MILVUS_ADDRESS,
      token: MILVUS_TOKEN,
    },
  });
  const query = "who is achilles?";
  const result = await milvus.similaritySearch(query, 1);

  const resultMetadatas = result.map(({ metadata }) => metadata);
  expect(resultMetadatas).toEqual([{ id: 1, other: objB }]);

  const resultTwo = await milvus.similaritySearch(query, 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([
    { id: 1, other: objB },
    { id: 4, other: objB },
    { id: 5, other: objA },
  ]);

  const resultThree = await milvus.similaritySearch(query, 1, 'id == "1"');
  const resultThreeMetadatas = resultThree.map(({ metadata }) => metadata);
  expect(resultThreeMetadatas).toEqual([{ id: 1, other: objB }]);
});

test.skip("Test Milvus.fromtext", async () => {
  const texts = [
    `Tortoise: Labyrinth? Labyrinth? Could it Are we in the notorious Little
Harmonic Labyrinth of the dreaded Majotaur?`,
    "Achilles: Yiikes! What is that?",
    `Tortoise: They say-although I person never believed it myself-that an I
    Majotaur has created a tiny labyrinth sits in a pit in the middle of
    it, waiting innocent victims to get lost in its fears complexity.
    Then, when they wander and dazed into the center, he laughs and
    laughs at them-so hard, that he laughs them to death!`,
    "Achilles: Oh, no!",
    "Tortoise: But it's only a myth. Courage, Achilles.",
  ];
  const objA = { A: { B: "some string" } };
  const objB = { A: { B: "some other string" } };
  const metadatas: object[] = [
    { id: 2, other: objA },
    { id: 1, other: objB },
    { id: 3, other: objA },
    { id: 4, other: objB },
    { id: 5, other: objA },
  ];
  const milvus = await Milvus.fromTexts(texts, metadatas, embeddings, {
    collectionName,
    autoId: false,
    primaryField: "id",
    clientConfig: {
      address: MILVUS_ADDRESS,
      token: MILVUS_TOKEN,
    },
  });

  const query = "who is achilles?";
  const result = await milvus.similaritySearch(query, 1);
  const resultMetadatas = result.map(({ metadata }) => metadata);
  expect(resultMetadatas).toEqual([{ id: 1, other: objB }]);

  const resultTwo = await milvus.similaritySearch(query, 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas).toEqual([
    { id: 1, other: objB },
    { id: 4, other: objB },
    { id: 5, other: objA },
  ]);

  const resultThree = await milvus.similaritySearch(query, 1, 'id == "1"');
  const resultThreeMetadatas = resultThree.map(({ metadata }) => metadata);
  expect(resultThreeMetadatas).toEqual([{ id: 1, other: objB }]);
});

test.skip("Test Milvus.fromExistingCollection", async () => {
  const milvus = await Milvus.fromExistingCollection(embeddings, {
    collectionName,
    autoId: false,
    primaryField: "id",
    clientConfig: {
      address: MILVUS_ADDRESS,
      token: MILVUS_TOKEN,
    },
  });

  const query = "who is achilles?";
  const result = await milvus.similaritySearch(query, 1);
  const resultMetadatas = result.map(({ metadata }) => metadata);
  expect(resultMetadatas.length).toBe(1);
  expect(resultMetadatas[0].id).toEqual(1);

  const resultTwo = await milvus.similaritySearch(query, 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas.length).toBe(3);
  expect(resultTwoMetadatas[0].id).toEqual(1);
  expect(resultTwoMetadatas[1].id).toEqual(4);
  expect(resultTwoMetadatas[2].id).toEqual(5);

  const resultThree = await milvus.similaritySearch(query, 1, 'id == "1"');
  const resultThreeMetadatas = resultThree.map(({ metadata }) => metadata);
  expect(resultThreeMetadatas.length).toBe(1);
  expect(resultThreeMetadatas[0].id).toEqual(1);
});

test.skip("Test Milvus.deleteData with filter", async () => {
  const milvus = await Milvus.fromExistingCollection(embeddings, {
    collectionName,
    autoId: false,
    primaryField: "id",
    clientConfig: {
      address: MILVUS_ADDRESS,
      token: MILVUS_TOKEN,
    },
  });

  const query = "who is achilles?";
  const result = await milvus.similaritySearch(query, 1);
  const resultMetadatas = result.map(({ metadata }) => metadata);
  const primaryId = resultMetadatas[0].id;
  expect(resultMetadatas.length).toBe(1);
  expect(resultMetadatas[0].id).toEqual(1);

  await milvus.delete({ filter: `id in ["${primaryId}"]` });

  const resultTwo = await milvus.similaritySearch(query, 1);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas[0].id).not.toEqual(primaryId);
});

test.skip("Test Milvus.deleteData with ids", async () => {
  const milvus = await Milvus.fromExistingCollection(embeddings, {
    collectionName,
    autoId: false,
    primaryField: "id",
    clientConfig: {
      address: MILVUS_ADDRESS,
      token: MILVUS_TOKEN,
    },
  });

  const query = "who is tortoise?";
  const result = await milvus.similaritySearch(query, 3);
  const resultMetadatas = result.map(({ metadata }) => metadata);
  const primaryIds = resultMetadatas.map((rm) => rm.id);
  expect(resultMetadatas.length).toBe(3);
  expect(resultMetadatas[0].id).toEqual(3);
  expect(resultMetadatas[1].id).toEqual(2);
  expect(resultMetadatas[2].id).toEqual(5);

  await milvus.delete({ ids: primaryIds });

  const resultTwo = await milvus.similaritySearch(query, 3);
  const resultTwoMetadatas = resultTwo.map(({ metadata }) => metadata);
  expect(resultTwoMetadatas[0].id).not.toEqual(3);
  expect(resultTwoMetadatas[0].id).not.toEqual(2);
  expect(resultTwoMetadatas[0].id).not.toEqual(5);
});

test.skip("Test Milvus.addDocuments with auto ID", async () => {
  const vectorstore = new Milvus(embeddings, {
    collectionName: `test_collection_${Math.random()
      .toString(36)
      .substring(7)}`,
    clientConfig: {
      address: MILVUS_ADDRESS,
      token: MILVUS_TOKEN,
    },
  });

  await vectorstore.addDocuments([
    new Document({
      pageContent: "test",
      metadata: { test: "a" },
    }),
  ]);

  const result = await vectorstore.similaritySearch("test", 1);
  const resultMetadatas = result.map(({ metadata }) => metadata);
  expect(resultMetadatas.length).toBe(1);
});

afterAll(async () => {
  if (!process.env.MILVUS_URL) return;
  const client = new MilvusClient(process.env.MILVUS_URL as string);
  const dropRes = await client.dropCollection({
    collection_name: collectionName,
  });
  // console.log("Drop collection response: ", dropRes)
  expect(dropRes.error_code).toBe(ErrorCode.SUCCESS);
});
