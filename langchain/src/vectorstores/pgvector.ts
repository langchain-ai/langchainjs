import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export interface PGVectorClient {
  similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]>;
  addVectors(
    vectors: number[][],
    documents: Document[],
    _ids?: string[]
  ): Promise<void>;
  prepare: () => void;
}

export class PGVectorStore extends VectorStore {
  tableName: string;

  queryName: string;

  client: PGVectorClient;

  constructor(client: PGVectorClient, embeddings: Embeddings) {
    super(embeddings);

    this.client = client;
    this.embeddings = embeddings;
  }

  async addDocuments(documents: Document[], ids?: string[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      ids
    );
  }

  async addVectors(
    vectors: number[][],
    documents: Document[],
    ids?: string[]
  ): Promise<void> {
    return this.client.addVectors(vectors, documents, ids);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    return this.client.similaritySearchVectorWithScore(query, k);
  }

  static async fromTexts(
    client: PGVectorClient,
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings
  ): Promise<PGVectorStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const newDoc = new Document({
        pageContent: texts[i],
        metadata: metadatas[i],
      });
      docs.push(newDoc);
    }
    return PGVectorStore.fromDocuments(client, docs, embeddings);
  }

  static async fromDocuments(
    client: PGVectorClient,
    docs: Document[],
    embeddings: Embeddings
  ): Promise<PGVectorStore> {
    const instance = new this(client, embeddings);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    client: PGVectorClient,
    embeddings: Embeddings
  ): Promise<PGVectorStore> {
    const instance = new this(client, embeddings);
    return instance;
  }
}
