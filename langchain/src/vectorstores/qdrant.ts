import { QdrantClient } from "@qdrant/js-client-rest";
import type { Schemas as QdrantSchemas } from "@qdrant/js-client-rest";
import { v4 as uuid } from "uuid";

import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
import { Document } from "../document.js";

export interface QdrantLibArgs {
  client?: QdrantClient;
  url?: string;
  collectionName?: string;
  collectionConfig?: QdrantSchemas["CreateCollection"];
}

type QdrantSearchResponse = QdrantSchemas["ScoredPoint"] & {
  payload: {
    metadata: object;
    content: string;
  };
};

export class QdrantVectorStore extends VectorStore {
  client: QdrantClient;

  collectionName: string;

  collectionConfig: QdrantSchemas["CreateCollection"];

  constructor(embeddings: Embeddings, args: QdrantLibArgs) {
    super(embeddings, args);

    const url =
      args.url ??
      // eslint-disable-next-line no-process-env
      (typeof process !== "undefined" ? process.env?.QDRANT_URL : undefined);

    if (!args.client && !url) {
      throw new Error("Qdrant client or url address must be set.");
    }

    this.client =
      args.client ||
      new QdrantClient({
        url,
      });

    this.collectionName = args.collectionName ?? "documents";

    this.collectionConfig = args.collectionConfig ?? {
      vectors: {
        size: 1536,
        distance: "Cosine",
      },
    };
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }

    await this.ensureCollection();

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
    k?: number,
    filter?: QdrantSchemas["Filter"]
  ): Promise<[Document, number][]> {
    if (!query) {
      return [];
    }

    await this.ensureCollection();

    const results = await this.client.search(this.collectionName, {
      vector: query,
      limit: k,
      filter,
    });

    const result: [Document, number][] = (
      results as QdrantSearchResponse[]
    ).map((res) => [
      new Document({
        metadata: res.payload.metadata,
        pageContent: res.payload.content,
      }),
      res.score,
    ]);

    return result;
  }

  async ensureCollection() {
    const response = await this.client.getCollections();

    const collectionNames = response.collections.map(
      (collection) => collection.name
    );

    if (!collectionNames.includes(this.collectionName)) {
      await this.client.createCollection(
        this.collectionName,
        this.collectionConfig
      );
    }
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: QdrantLibArgs
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
    dbConfig: QdrantLibArgs
  ): Promise<QdrantVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingCollection(
    embeddings: Embeddings,
    dbConfig: QdrantLibArgs
  ): Promise<QdrantVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.ensureCollection();
    return instance;
  }
}
