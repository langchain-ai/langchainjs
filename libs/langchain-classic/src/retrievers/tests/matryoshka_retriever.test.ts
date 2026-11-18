import { describe, expect, test } from "vitest";
import { DocumentInterface } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { VectorStore } from "@langchain/core/vectorstores";

import { MatryoshkaRetriever } from "../matryoshka_retriever.js";

/**
 * Large embeddings, keyed by page content. The query is [1, 0, 0], so "near"
 * is the closest document and "far" the furthest under every search type.
 */
const LARGE_EMBEDDINGS: Record<string, number[]> = {
  near: [1, 0, 0],
  mid: [0.5, 0.5, 0],
  far: [-1, 0, 0],
};
const QUERY_EMBEDDING = [1, 0, 0];

class StubLargeEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((document) => LARGE_EMBEDDINGS[document]);
  }

  async embedQuery(_query: string): Promise<number[]> {
    return QUERY_EMBEDDING;
  }
}

/**
 * Network-free vector store. The first pass of the retriever is not under
 * test, so similarity search just returns every stored document, in an order
 * that is deliberately not the order of the large embeddings.
 */
class StubVectorStore extends VectorStore {
  declare FilterType: object;

  documents: DocumentInterface[] = [];

  constructor() {
    super(new FakeEmbeddings(), {});
  }

  _vectorstoreType(): string {
    return "stub";
  }

  async addVectors(
    _vectors: number[][],
    documents: DocumentInterface[]
  ): Promise<void> {
    this.documents.push(...documents);
  }

  async addDocuments(documents: DocumentInterface[]): Promise<void> {
    this.documents.push(...documents);
  }

  async similaritySearchVectorWithScore(): Promise<
    [DocumentInterface, number][]
  > {
    return this.documents.map((document) => [document, 0]);
  }
}

async function createRetriever(
  searchType: "cosine" | "innerProduct" | "euclidean",
  largeK: number
) {
  const retriever = new MatryoshkaRetriever({
    vectorStore: new StubVectorStore(),
    largeEmbeddingModel: new StubLargeEmbeddings(),
    largeK,
  });
  // The constructor input type intersects MatryoshkaRetrieverFields with
  // VectorStoreRetrieverInput, whose `searchType` is "similarity" | "mmr", so
  // the Matryoshka search types can only be set on the instance.
  retriever.searchType = searchType;
  await retriever.addDocuments([
    { pageContent: "far", metadata: {} },
    { pageContent: "near", metadata: {} },
    { pageContent: "mid", metadata: {} },
  ]);
  return retriever;
}

describe("MatryoshkaRetriever re-ranking with the large embeddings", () => {
  for (const searchType of ["cosine", "innerProduct", "euclidean"] as const) {
    describe(searchType, () => {
      test("keeps the closest document when largeK is 1", async () => {
        const retriever = await createRetriever(searchType, 1);
        const docs = await retriever.invoke("query");
        expect(docs.map((doc) => doc.pageContent)).toEqual(["near"]);
      });

      test("orders documents from closest to furthest", async () => {
        const retriever = await createRetriever(searchType, 3);
        const docs = await retriever.invoke("query");
        expect(docs.map((doc) => doc.pageContent)).toEqual([
          "near",
          "mid",
          "far",
        ]);
      });
    });
  }
});
