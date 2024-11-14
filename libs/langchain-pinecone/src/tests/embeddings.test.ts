import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeEmbeddings } from "../embeddings.js";
import { getPineconeClient } from "../client.js";

// Mock the Pinecone class
jest.mock("@pinecone-database/pinecone", () => ({
  Pinecone: jest.fn().mockImplementation((config) => ({
    config,
    inference: { embed: jest.fn() },
  })),
}));

// Mock getPineconeClient
jest.mock("../client.js", () => ({
  getPineconeClient: jest.fn(),
}));

beforeAll(() => {
  // eslint-disable-next-line no-process-env
  process.env.PINECONE_API_KEY = "test-api-key";
});

describe("Tests for the PineconeEmbeddings class", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  test("embedDocuments calls client with correct parameters", async () => {
    const texts = ["Sample text"];
    const mockEmbeddings = [{ values: [0.1, 0.2, 0.3] }];

    const mockClient = new Pinecone();
    mockClient.inference.embed = jest.fn().mockResolvedValue(mockEmbeddings);
    (getPineconeClient as jest.Mock).mockReturnValue(mockClient);

    const model = new PineconeEmbeddings();
    const embeddings = await model.embedDocuments(texts);

    expect(mockClient.inference.embed).toHaveBeenCalledWith(
      "multilingual-e5-large",
      texts,
      { inputType: "passage" }
    );
    expect(embeddings).toEqual([[0.1, 0.2, 0.3]]);
  });

  test("embedQuery calls client with correct parameters", async () => {
    const query = "Some query";
    const mockEmbeddings = [{ values: [0.1, 0.2, 0.3] }];

    const mockClient = new Pinecone();
    mockClient.inference.embed = jest.fn().mockResolvedValue(mockEmbeddings);
    (getPineconeClient as jest.Mock).mockReturnValue(mockClient);

    const model = new PineconeEmbeddings();
    const embeddings = await model.embedQuery(query);

    expect(mockClient.inference.embed).toHaveBeenCalledWith(
      "multilingual-e5-large",
      [query],
      { inputType: "query" }
    );
    expect(embeddings).toEqual([0.1, 0.2, 0.3]);
  });
});
