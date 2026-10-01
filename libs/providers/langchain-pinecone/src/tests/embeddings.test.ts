import { test, expect, beforeAll, vi } from "vitest";
import type { EmbeddingsList } from "@pinecone-database/pinecone";

import { PineconeEmbeddings } from "../embeddings.js";

beforeAll(() => {
  process.env.PINECONE_API_KEY = "test-api-key";
});

test("confirm embedDocuments method throws error when an empty array is passed", async () => {
  const model = new PineconeEmbeddings();
  const errorThrown = async () => {
    await model.embedDocuments([]);
  };
  await expect(errorThrown).rejects.toThrow(Error);
  await expect(errorThrown).rejects.toThrowError(
    "At least one document is required to generate embeddings"
  );
});

test("confirm embedQuery method throws error when an empty string is passed", async () => {
  const model = new PineconeEmbeddings();
  const errorThrown = async () => {
    await model.embedQuery("");
  };
  await expect(errorThrown).rejects.toThrow(Error);
  await expect(errorThrown).rejects.toThrowError(
    "No query passed for which to generate embeddings"
  );
});

test("confirm instance defaults are set when no args are passed", async () => {
  const model = new PineconeEmbeddings();
  expect(model.model).toBe("multilingual-e5-large");
  expect(model.params).toEqual({ inputType: "passage" });
});

test("confirm instance sets custom model and params when provided", () => {
  const customModel = new PineconeEmbeddings({
    model: "custom-model",
    params: { customParam: "value" },
  });
  expect(customModel.model).toBe("custom-model");
  expect(customModel.params).toEqual({
    inputType: "passage",
    customParam: "value",
  });
});

const embeddingsList: EmbeddingsList = {
  model: "multilingual-e5-large",
  vectorType: "dense",
  data: [{ vectorType: "dense", values: [0.1, 0.2] }],
  usage: { totalTokens: 1 },
};

test("embedDocuments passes the model, inputs and parameters to inference.embed as one options object", async () => {
  const model = new PineconeEmbeddings();
  const embed = vi
    .spyOn(model.client.inference, "embed")
    .mockResolvedValue(embeddingsList);

  const result = await model.embedDocuments(["hello", "world"]);

  expect(embed).toHaveBeenCalledTimes(1);
  expect(embed).toHaveBeenCalledWith({
    model: "multilingual-e5-large",
    inputs: ["hello", "world"],
    parameters: { inputType: "passage" },
  });
  expect(result).toEqual([[0.1, 0.2]]);
});

test("embedQuery passes the model, input and query parameters to inference.embed as one options object", async () => {
  const model = new PineconeEmbeddings();
  const embed = vi
    .spyOn(model.client.inference, "embed")
    .mockResolvedValue(embeddingsList);

  const result = await model.embedQuery("hello");

  expect(embed).toHaveBeenCalledTimes(1);
  expect(embed).toHaveBeenCalledWith({
    model: "multilingual-e5-large",
    inputs: ["hello"],
    parameters: { inputType: "query" },
  });
  expect(result).toEqual([0.1, 0.2]);
});
