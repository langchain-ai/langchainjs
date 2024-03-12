import { describe, test, expect } from "@jest/globals";
import { PremEmbeddings } from "../embeddings.js";

describe("EmbeddingsPrem", () => {
  test("Test embedQuery", async () => {
    const client = new PremEmbeddings({ model: "@cf/baai/bge-small-en-v1.5" });
    const res = await client.embedQuery("Hello world");
    // console.log(res);
    expect(typeof res[0]).toBe("number");
  });
});
