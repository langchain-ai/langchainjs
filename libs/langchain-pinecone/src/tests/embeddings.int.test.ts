import { PineconeEmbeddings } from "../embeddings.js";

describe("Integration tests for Pinecone embeddings", () => {
  test("Happy path: defaults for both embedDocuments and embedQuery", async () => {
    const model = new PineconeEmbeddings();
    expect(model.model).toBe("multilingual-e5-large");
    expect(model.params).toEqual({ inputType: "passage" });

    const docs = ["hello", "world"];
    const embeddings = await model.embedDocuments(docs);
    expect(embeddings.length).toBe(docs.length);

    const query = "hello";
    const queryEmbedding = await model.embedQuery(query);
    expect(queryEmbedding.length).toBeGreaterThan(0);
  });

  test("Happy path: custom `params` obj passed to embedDocuments and embedQuery", async () => {
    const model = new PineconeEmbeddings({
      params: { customParam: "value" },
    });
    expect(model.model).toBe("multilingual-e5-large");
    expect(model.params).toEqual({
      inputType: "passage",
      customParam: "value",
    });

    const docs = ["hello", "world"];
    const embeddings = await model.embedDocuments(docs);
    expect(embeddings.length).toBe(docs.length);
    expect(embeddings[0].length).toBe(1024); // Assert correct dims on random doc
    expect(model.model).toBe("multilingual-e5-large");
    expect(model.params).toEqual({
      inputType: "passage", // Maintain default inputType for docs
      customParam: "value",
    });

    const query = "hello";
    const queryEmbedding = await model.embedQuery(query);
    expect(model.model).toBe("multilingual-e5-large");
    expect(queryEmbedding.length).toBe(1024);
    expect(model.params).toEqual({
      inputType: "query", // Change inputType for query
      customParam: "value",
    });
  });

  test("Unhappy path: embedDocuments and embedQuery throw when empty objs are passed", async () => {
    const model = new PineconeEmbeddings();
    await expect(model.embedDocuments([])).rejects.toThrow();
    await expect(model.embedQuery("")).rejects.toThrow();
  });

  test("Unhappy path: PineconeEmbeddings throws when invalid model is passed", async () => {
    const model = new PineconeEmbeddings({ model: "invalid-model" });
    await expect(model.embedDocuments([])).rejects.toThrow();
    await expect(model.embedQuery("")).rejects.toThrow();
  });
});
