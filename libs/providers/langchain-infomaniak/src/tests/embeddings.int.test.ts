import { describe, test, expect } from "vitest";
import { InfomaniakEmbeddings } from "../embeddings.js";

describe("InfomaniakEmbeddings integration", () => {
  test("embedQuery returns a vector", async () => {
    const embeddings = new InfomaniakEmbeddings({
      model: "bge_multilingual_gemma2",
    });
    const vector = await embeddings.embedQuery("Hello world");
    expect(Array.isArray(vector)).toBe(true);
    expect(vector.length).toBeGreaterThan(0);
    expect(typeof vector[0]).toBe("number");
  });

  test("embedDocuments returns vectors for multiple texts", async () => {
    const embeddings = new InfomaniakEmbeddings({
      model: "bge_multilingual_gemma2",
    });
    const vectors = await embeddings.embedDocuments([
      "Hello world",
      "Bonjour le monde",
      "Hallo Welt",
    ]);
    expect(vectors.length).toBe(3);
    for (const vector of vectors) {
      expect(Array.isArray(vector)).toBe(true);
      expect(vector.length).toBeGreaterThan(0);
    }
    // All vectors should have the same dimension
    expect(vectors[0].length).toBe(vectors[1].length);
    expect(vectors[1].length).toBe(vectors[2].length);
  });

  // Note: Infomaniak API does not currently support the `dimensions` parameter.
  // See: 500 {"detail":"dimensions is currently not supported"}
});
