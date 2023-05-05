import { v4 as uuid } from "uuid";
import type { QdrantClient } from "@qdrant/js-client-rest";

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";

interface QdrantSearchResponse {
  id: number;
  score: number;
  payload: {
    content: string;
    metadata: object;
  };
}

export interface QdrantArgs {
  client: QdrantClient;
  collectionName?: string;
}

export class QdrantVectorStore extends VectorStore {
  client: QdrantClient;

  collectionName: string;

  constructor(embeddings: Embeddings, args: QdrantArgs) {
    super(embeddings, args);
    this.client = args.client;
    this.collectionName = args.collectionName || "documents";
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const points = vectors.map((embedding, idx) => ({
      id: uuid(),
      vector: embedding,
      payload: {
        content: documents[idx].pageContent,
        metadata: documents[idx].metadata,
      },
    }));

    await this.client.upsert(this.collectionName, {
      wait: true,
      points,
    });
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    const results = await this.client.search(this.collectionName, {
      vector: query,
      limit: k,
    });

    const result: [Document, number][] = (
      results as unknown as QdrantSearchResponse[]
    ).map((resp) => [
      new Document({
        metadata: resp.payload.metadata,
        pageContent: resp.payload.content,
      }),
      resp.score,
    ]);

    return result;
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: QdrantArgs
  ): Promise<QdrantVectorStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return QdrantVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: QdrantArgs
  ): Promise<QdrantVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: QdrantArgs
  ): Promise<QdrantVectorStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
