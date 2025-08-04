import { PineconeEmbeddings } from "../embeddings.js";

beforeAll(() => {
  // eslint-disable-next-line no-process-env
  process.env.PINECONE_API_KEY = "test-api-key";
});

describe("Tests for the PineconeEmbeddings class", () => {
  test("Confirm embedDocuments method throws error when an empty array is passed", async () => {
    const model = new PineconeEmbeddings();
    const errorThrown = async () => {
      await model.embedDocuments([]);
    };
    await expect(errorThrown).rejects.toThrow(Error);
    await expect(errorThrown).rejects.toThrowError(
      "At least one document is required to generate embeddings"
    );
  });

  test("Confirm embedQuery method throws error when an empty string is passed", async () => {
    const model = new PineconeEmbeddings();
    const errorThrown = async () => {
      await model.embedQuery("");
    };
    await expect(errorThrown).rejects.toThrow(Error);
    await expect(errorThrown).rejects.toThrowError(
      "No query passed for which to generate embeddings"
    );
  });

  test("Confirm instance defaults are set when no args are passed", async () => {
    const model = new PineconeEmbeddings();
    expect(model.model).toBe("multilingual-e5-large");
    expect(model.params).toEqual({ inputType: "passage" });
  });

  test("Confirm instance sets custom model and params when provided", () => {
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
});
