import * as math from "mathjs";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

type MemoryVector = {
  content: string;
  embedding: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
};

export class MemoryVectorStore extends VectorStore {
  memoryVectors: MemoryVector[] = [];

  constructor(embeddings: Embeddings, args?: Record<string, any>) {
    super(embeddings, args || {});
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const memoryVectors = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
    }));

    this.memoryVectors = this.memoryVectors.concat(memoryVectors);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    let searches = this.memoryVectors.map((vector, index) => ({
        similarity: math.dot(query, vector.embedding),
        index,
      }));

    searches.sort((a, b) => (a.similarity > b.similarity ? -1 : 0));
    searches = searches.slice(0, k);

    const result: [Document, number][] = searches.map((search) => [
      new Document({
        metadata: this.memoryVectors[search.index].metadata,
        pageContent: this.memoryVectors[search.index].content,
      }),
      search.similarity,
    ]);

    return result;
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: Record<string, any>
  ): Promise<MemoryVectorStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return MemoryVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: Record<string, any>
  ): Promise<MemoryVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: Record<string, any>
  ): Promise<MemoryVectorStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
