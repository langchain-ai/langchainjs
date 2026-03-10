import { describe, test, expect, beforeAll } from "vitest";
import { InfomaniakEmbeddings } from "../embeddings.js";

beforeAll(() => {
  process.env.INFOMANIAK_API_KEY = "test-key";
  process.env.INFOMANIAK_PRODUCT_ID = "12345";
});

describe("InfomaniakEmbeddings", () => {
  test("should instantiate with defaults", () => {
    const embeddings = new InfomaniakEmbeddings();
    expect(embeddings.model).toBe("bge_multilingual_gemma2");
  });

  test("should instantiate with custom model", () => {
    const embeddings = new InfomaniakEmbeddings({
      model: "custom-model",
    });
    expect(embeddings.model).toBe("custom-model");
  });

  test("should throw if API key is missing", () => {
    const original = process.env.INFOMANIAK_API_KEY;
    process.env.INFOMANIAK_API_KEY = "";
    expect(() => new InfomaniakEmbeddings({ apiKey: "" })).toThrow(
      "Infomaniak API key not found"
    );
    process.env.INFOMANIAK_API_KEY = original;
  });

  test("should throw if product ID is missing", () => {
    const original = process.env.INFOMANIAK_PRODUCT_ID;
    process.env.INFOMANIAK_PRODUCT_ID = "";
    expect(() => new InfomaniakEmbeddings({ productId: "" })).toThrow(
      "Infomaniak product ID not found"
    );
    process.env.INFOMANIAK_PRODUCT_ID = original;
  });

  test("should accept dimensions parameter", () => {
    const embeddings = new InfomaniakEmbeddings({
      dimensions: 1536,
    });
    expect(embeddings.dimensions).toBe(1536);
  });

  test("should accept batchSize parameter", () => {
    const embeddings = new InfomaniakEmbeddings({
      batchSize: 100,
    });
    expect(embeddings.batchSize).toBe(100);
  });
});
