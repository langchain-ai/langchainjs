import { test, expect, beforeAll, vi } from "vitest";

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

test("embedQuery does not change the inputType used by later embedDocuments calls", async () => {
  const model = new PineconeEmbeddings();
  const embed = vi.fn().mockResolvedValue({ data: [{ values: [0.1, 0.2] }] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (model as any).client = { inference: { embed } };

  await model.embedQuery("what is a query?");
  await model.embedDocuments(["a document"]);

  expect(embed.mock.calls[0][2]).toEqual({ inputType: "query" });
  expect(embed.mock.calls[1][2]).toEqual({ inputType: "passage" });
  expect(model.params).toEqual({ inputType: "passage" });
});
