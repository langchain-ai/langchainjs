import type { VectorOperationsApi } from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch";
import { v4 as uuidv4 } from "uuid";

import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
type PineconeMetadata = Record<string, any>;

export class PineconeStore extends VectorStore {
  textKey: string;

  namespace: string | undefined;

  pineconeClient: VectorOperationsApi;

  constructor(
    pineconeClient: VectorOperationsApi,
    embeddings: Embeddings,
    textKey = "text",
    namespace: string | undefined = undefined
  ) {
    super(embeddings);

    this.pineconeClient = pineconeClient;
    this.embeddings = embeddings;
    this.textKey = textKey;
    this.namespace = namespace;
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
    const documentIds = ids == null ? documents.map(() => uuidv4()) : ids;

    await this.pineconeClient.upsert({
      upsertRequest: {
        vectors: vectors.map((values, idx) => ({
          id: documentIds[idx],
          metadata: {
            ...documents[idx].metadata,
            [this.textKey]: documents[idx].pageContent,
          },
          values,
        })),
        namespace: this.namespace,
      },
    });
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    const results = await this.pineconeClient.query({
      queryRequest: {
        topK: k,
        includeMetadata: true,
        vector: query,
        namespace: this.namespace,
      },
    });

    const result: [Document, number][] = [];

    if (results.matches) {
      for (const res of results.matches) {
        const { [this.textKey]: pageContent, ...metadata } = (res.metadata ??
          {}) as PineconeMetadata;
        if (res.score) {
          result.push([new Document({ metadata, pageContent }), res.score]);
        }
      }
    }

    return result;
  }

  static async fromTexts(
    pineconeClient: VectorOperationsApi,
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings,
    textKey = "text",
    namespace: string | undefined = undefined
  ): Promise<PineconeStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const newDoc = new Document({
        pageContent: texts[i],
        metadata: metadatas[i],
      });
      docs.push(newDoc);
    }

    return PineconeStore.fromDocuments(
      pineconeClient,
      docs,
      embeddings,
      textKey,
      namespace
    );
  }

  static async fromDocuments(
    pineconeClient: VectorOperationsApi,
    docs: Document[],
    embeddings: Embeddings,
    textKey = "text",
    namespace: string | undefined = undefined
  ): Promise<PineconeStore> {
    const instance = new this(pineconeClient, embeddings, textKey, namespace);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    pineconeClient: VectorOperationsApi,
    embeddings: Embeddings,
    textKey = "text",
    namespace: string | undefined = undefined
  ): Promise<PineconeStore> {
    const instance = new this(pineconeClient, embeddings, textKey, namespace);
    return instance;
  }
}
