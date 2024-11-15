import { Pinecone, PineconeConfiguration } from "@pinecone-database/pinecone";
import { jest } from "@jest/globals";
import { getPineconeClient } from "../client.js";

// Mock the Pinecone class
jest.mock("@pinecone-database/pinecone", () => ({
  Pinecone: jest.fn().mockImplementation((config) => ({
    config,
    inference: { embed: jest.fn() },
  })),
}));

describe("Tests for getPineconeClient", () => {
  test("Confirm getPineconeClient throws error when PINECONE_API_KEY is not set", async () => {
    /* eslint-disable-next-line no-process-env */
    process.env.PINECONE_API_KEY = "";
    const errorThrown = async () => {
      getPineconeClient();
    };
    await expect(errorThrown).rejects.toThrow(Error);
    await expect(errorThrown).rejects.toThrow(
      "PINECONE_API_KEY must be set in environment"
    );
  });

  test("Confirm getPineconeClient calls Pinecone class (mocked) with and without config", async () => {
    /* eslint-disable-next-line no-process-env */
    process.env.PINECONE_API_KEY = "some-valid-api-key";

    // With config
    // Note: cannot assert on config contents themselves b/c `config` is a private attribute of the Pinecone class
    const config: PineconeConfiguration = {
      apiKey: "some-valid-api-key",
      additionalHeaders: { header: "value" },
    };
    getPineconeClient(config);
    expect(Pinecone).toHaveBeenCalledWith(config);

    // Without config
    getPineconeClient();
    expect(Pinecone).toHaveBeenCalledWith();
  });
});
