import { getPineconeClient } from "../client.js";

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
});
