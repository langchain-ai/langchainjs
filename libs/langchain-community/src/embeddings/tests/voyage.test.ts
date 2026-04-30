import { test, expect } from "@jest/globals";
import { VoyageEmbeddings } from "../voyage.js";

test("VoyageEmbeddings defaults native keys to the Voyage AI endpoint", () => {
  const embeddings = new VoyageEmbeddings({
    apiKey: "pa-test-key",
  });

  expect(embeddings.apiUrl).toBe("https://api.voyageai.com/v1/embeddings");
});

test("VoyageEmbeddings defaults Atlas keys to the MongoDB AI endpoint", () => {
  const embeddings = new VoyageEmbeddings({
    apiKey: "al-test-key",
  });

  expect(embeddings.apiUrl).toBe("https://ai.mongodb.com/v1/embeddings");
});

test("VoyageEmbeddings uses the provided basePath when set", () => {
  const embeddings = new VoyageEmbeddings({
    apiKey: "al-test-key",
    basePath: "https://example.test/v1",
  });

  expect(embeddings.apiUrl).toBe("https://example.test/v1/embeddings");
});
