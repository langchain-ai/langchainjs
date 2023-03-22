import type { VectorOperationsApi } from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch";
import { v4 as uuidv4 } from "uuid";

import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
type PineconeMetadata = Record<string, any>;

export interface PineconeLibArgs {
  pineconeIndex: VectorOperationsApi;
  textKey?: string;
  namespace?: string;
  filter?: PineconeMetadata;
}

export class PineconeStore extends VectorStore {
  textKey: string;

  namespace?: string;

  pineconeIndex: VectorOperationsApi;

  filter?: PineconeMetadata;

  constructor(embeddings: Embeddings, args: PineconeLibArgs) {
    super(embeddings, args);

    this.embeddings = embeddings;
    this.namespace = args.namespace;
    this.pineconeIndex = args.pineconeIndex;
    this.textKey = args.textKey ?? "text";
    this.filter = args.filter;
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

    await this.pineconeIndex.upsert({
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
    k: number,
    filter?: object
  ): Promise<[Document, number][]> {
    if (filter && this.filter) {
      throw new Error("cannot provide both `filter` and `this.filter`");
    }
    const _filter = filter ?? this.filter;
    const results = await this.pineconeIndex.query({
      queryRequest: {
        includeMetadata: true,
        namespace: this.namespace,
        topK: k,
        vector: query,
        filter: _filter,
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
    texts: string[],
    metadatas: object[],
    embeddings: Embeddings,
    dbConfig:
      | {
          /**
           * @deprecated Use pineconeIndex instead
           */
          pineconeClient: VectorOperationsApi;
          textKey?: string;
          namespace?: string | undefined;
        }
      | PineconeLibArgs
  ): Promise<PineconeStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const newDoc = new Document({
        pageContent: texts[i],
        metadata: metadatas[i],
      });
      docs.push(newDoc);
    }

    const args: PineconeLibArgs = {
      pineconeIndex:
        "pineconeIndex" in dbConfig
          ? dbConfig.pineconeIndex
          : dbConfig.pineconeClient,
      textKey: dbConfig.textKey,
      namespace: dbConfig.namespace,
    };
    return PineconeStore.fromDocuments(docs, embeddings, args);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: PineconeLibArgs
  ): Promise<PineconeStore> {
    const args = dbConfig;
    args.textKey = dbConfig.textKey ?? "text";

    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: PineconeLibArgs
  ): Promise<PineconeStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
