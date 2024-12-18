import { Pinecone } from "@pinecone-database/pinecone";
import { getPineconeClient } from "../client.js";

describe("Tests for getPineconeClient", () => {
  test("Happy path for getPineconeClient with and without `config` obj passed", async () => {
    const client = getPineconeClient();
    expect(client).toBeInstanceOf(Pinecone);
    expect(client).toHaveProperty("config"); // Config is always set to *at least* the user's api key

    const clientWithConfig = getPineconeClient({
      // eslint-disable-next-line no-process-env
      apiKey: process.env.PINECONE_API_KEY!,
      additionalHeaders: { header: "value" },
    });
    expect(clientWithConfig).toBeInstanceOf(Pinecone);
    expect(client).toHaveProperty("config"); // Unfortunately cannot assert on contents of config b/c it's a private
    // attribute of the Pinecone class
  });

  test("Unhappy path: expect getPineconeClient to throw error if reset PINECONE_API_KEY to empty string", async () => {
    // eslint-disable-next-line no-process-env
    const originalApiKey = process.env.PINECONE_API_KEY;
    try {
      // eslint-disable-next-line no-process-env
      process.env.PINECONE_API_KEY = "";
      const errorThrown = async () => {
        getPineconeClient();
      };
      await expect(errorThrown).rejects.toThrow(Error);
      await expect(errorThrown).rejects.toThrow(
        "PINECONE_API_KEY must be set in environment"
      );
    } finally {
      // Restore the original value of PINECONE_API_KEY
      // eslint-disable-next-line no-process-env
      process.env.PINECONE_API_KEY = originalApiKey;
    }
  });
});
