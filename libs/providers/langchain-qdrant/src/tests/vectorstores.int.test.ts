import { afterAll, describe, expect, test } from "vitest";
import { QdrantClient } from "@qdrant/js-client-rest";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import { v4 } from "@langchain/core/utils/uuid";
import {
  QdrantVectorStore,
  type SparseEmbeddingsInterface,
} from "../vectorstores.js";

describe("QdrantVectorStore testcase", () => {
  test("base usage", async () => {
    const embeddings = new SyntheticEmbeddings({
      vectorSize: 1536,
    });

    const qdrantVectorStore = new QdrantVectorStore(embeddings, {
      url: process.env.QDRANT_URL || "http://localhost:6333",
      collectionName: process.env.QDRANT_COLLECTION || "documents",
    });

    const pageContent = faker.lorem.sentence(5);
    const id = v4();
    await qdrantVectorStore.addDocuments([{ pageContent, metadata: {}, id }]);

    const results = await qdrantVectorStore.similaritySearch(pageContent, 1);
    expect(results[0]).toEqual(new Document({ metadata: {}, pageContent, id }));
    expect(qdrantVectorStore.maxMarginalRelevanceSearch).toBeDefined();

    const mmrResults = await qdrantVectorStore.maxMarginalRelevanceSearch(
      pageContent,
      {
        k: 1,
      }
    );
    expect(mmrResults.length).toBe(1);
    expect(mmrResults[0]).toEqual(
      new Document({ metadata: {}, pageContent, id })
    );
  });

  test("passing client directly with a model that creates embeddings with a different number of dimensions", async () => {
    const embeddings = new SyntheticEmbeddings({
      vectorSize: 384,
    });

    const pageContent = faker.lorem.sentence(5);

    const qdrantVectorStore = await QdrantVectorStore.fromDocuments(
      [{ pageContent, metadata: {} }],
      embeddings,
      {
        collectionName: "different_dimensions",
        client: new QdrantClient({
          url: process.env.QDRANT_URL,
          apiKey: process.env.QDRANT_API_KEY,
        }),
      }
    );

    const results = await qdrantVectorStore.similaritySearch(pageContent, 1);

    expect(results[0].metadata).toEqual({});
    expect(results[0].pageContent).toEqual(pageContent);
  });

  test("maxMarginalRelevanceSearch returns diverse results", async () => {
    const embeddings = new SyntheticEmbeddings({ vectorSize: 128 });

    const docs = [
      new Document({ pageContent: "apple orange banana" }),
      new Document({ pageContent: "carrot potato tomato" }),
      new Document({ pageContent: "rose tulip daisy" }),
      new Document({ pageContent: "dog cat mouse" }),
    ];

    const qdrantVectorStore = await QdrantVectorStore.fromDocuments(
      docs,
      embeddings,
      {
        collectionName: "mmr_test_collection",
        url: process.env.QDRANT_URL || "http://localhost:6333",
      }
    );

    const mmrResults = await qdrantVectorStore.maxMarginalRelevanceSearch(
      "fruit vegetable animal",
      { k: 3 }
    );

    expect(mmrResults.length).toBe(3);
  });
});

/**
 * Dense embeddings that point every text away from `TARGET`, so that only
 * the sparse side can find it.
 */
class TwoWayEmbeddings extends Embeddings {
  constructor(private target: string) {
    super({});
  }

  async embedDocuments(texts: string[]) {
    return texts.map((text) => this.embed(text));
  }

  async embedQuery(text: string) {
    return this.embed(text);
  }

  private embed(text: string) {
    return text === this.target ? [0, 1] : [1, 0];
  }
}

/**
 * Toy client-side sparse model: one index per distinct lowercase word.
 */
class WordSparseEmbeddings implements SparseEmbeddingsInterface {
  async embedDocuments(texts: string[]) {
    return texts.map((text) => this.embed(text));
  }

  async embedQuery(text: string) {
    return this.embed(text);
  }

  private embed(text: string) {
    const indices = [
      ...new Set(
        text
          .toLowerCase()
          .split(/\W+/)
          .filter(Boolean)
          .map((word) =>
            [...word].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
          )
      ),
    ];
    return { indices, values: indices.map(() => 1) };
  }
}

describe("QdrantVectorStore sparse and hybrid retrieval", () => {
  const url = process.env.QDRANT_URL || "http://localhost:6333";
  const client = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
  const TARGET = "Il contratto a termine dura al massimo dodici mesi.";
  const docs = [
    new Document({ pageContent: TARGET, metadata: { topic: "contracts" } }),
    new Document({
      pageContent: "Le ferie annuali sono di quattro settimane.",
      metadata: { topic: "holidays" },
    }),
    new Document({
      pageContent: "Lo stipendio viene pagato alla fine del mese.",
      metadata: { topic: "salary" },
    }),
  ];
  const embeddings = new TwoWayEmbeddings(TARGET);
  const sparseDocumentOptions = {
    model: "qdrant/bm25",
    options: { language: "italian" },
  };
  const collections: string[] = [];

  function collectionName(prefix: string) {
    const name = `${prefix}_${v4()}`;
    collections.push(name);
    return name;
  }

  afterAll(async () => {
    await Promise.all(
      collections.map((name) => client.deleteCollection(name).catch(() => {}))
    );
  });

  test("hybrid mode finds a chunk that only BM25 matches (via stemming)", async () => {
    const collection = collectionName("hybrid");
    const hybrid = await QdrantVectorStore.fromDocuments(docs, embeddings, {
      client,
      collectionName: collection,
      retrievalMode: "hybrid",
      sparseDocumentOptions,
    });
    const dense = new QdrantVectorStore(embeddings, {
      client,
      collectionName: collection,
    });

    const hybridResults = await hybrid.similaritySearch("contratti", 2);
    const denseResults = await dense.similaritySearch("contratti", 2);

    expect(hybridResults.map((d) => d.pageContent)).toContain(TARGET);
    expect(denseResults.map((d) => d.pageContent)).not.toContain(TARGET);

    const retrieved = await hybrid.asRetriever({ k: 2 }).invoke("contratti");
    expect(retrieved.map((d) => d.pageContent)).toContain(TARGET);

    const filtered = await hybrid.similaritySearch("contratti", 2, {
      must_not: [{ key: "metadata.topic", match: { value: "contracts" } }],
    });
    expect(filtered.map((d) => d.pageContent)).not.toContain(TARGET);
  });

  test("sparse mode works on a sparse-only collection", async () => {
    const store = await QdrantVectorStore.fromDocuments(docs, embeddings, {
      client,
      collectionName: collectionName("sparse"),
      retrievalMode: "sparse",
      sparseDocumentOptions,
    });

    const results = await store.similaritySearchWithScore("contratti", 3);
    expect(results).toHaveLength(1);
    expect(results[0][0].pageContent).toBe(TARGET);

    const filtered = await store.similaritySearch("contratti", 3, {
      must: [{ key: "metadata.topic", match: { value: "salary" } }],
    });
    expect(filtered).toHaveLength(0);
  });

  test("sparse mode works with client-side sparseEmbeddings", async () => {
    const store = await QdrantVectorStore.fromDocuments(docs, embeddings, {
      client,
      collectionName: collectionName("sparse_client"),
      retrievalMode: "sparse",
      sparseEmbeddings: new WordSparseEmbeddings(),
    });

    const results = await store.similaritySearch("ferie", 3);
    expect(results.map((d) => d.metadata.topic)).toEqual(["holidays"]);
  });

  test("hybrid mode on a collection without the sparse vector fails", async () => {
    const collection = collectionName("dense_only");
    await QdrantVectorStore.fromDocuments(docs, embeddings, {
      client,
      collectionName: collection,
    });
    const hybrid = new QdrantVectorStore(embeddings, {
      client,
      collectionName: collection,
      retrievalMode: "hybrid",
      sparseDocumentOptions,
    });

    await expect(hybrid.similaritySearch("contratti", 2)).rejects.toThrow();
  });
});
