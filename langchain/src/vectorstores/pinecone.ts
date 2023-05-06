import * as uuid from "uuid";
import flatten from "flat";

import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
type PineconeMetadata = Record<string, any>;

type VectorOperationsApi = ReturnType<
  import("@pinecone-database/pinecone").PineconeClient["Index"]
>;

export interface PineconeLibArgs {
  pineconeIndex: VectorOperationsApi;
  textKey?: string;
  namespace?: string;
  filter?: PineconeMetadata;
}

export class PineconeStore extends VectorStore {
  declare FilterType: PineconeMetadata;

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
    const documentIds = ids == null ? documents.map(() => uuid.v4()) : ids;
    const pineconeVectors = vectors.map((values, idx) => {
      // Pinecone doesn't support nested objects, so we flatten them
      const metadata: {
        [key: string]: string | number | boolean | null;
      } = flatten({
        ...documents[idx].metadata,
        [this.textKey]: documents[idx].pageContent,
      });
      // Pinecone doesn't support null values, so we remove them
      for (const key of Object.keys(metadata)) {
        if (metadata[key] == null) {
          delete metadata[key];
        } else if (
          typeof metadata[key] === "object" &&
          Object.keys(metadata[key] as unknown as object).length === 0
        ) {
          delete metadata[key];
        }
      }
      return {
        id: documentIds[idx],
        metadata,
        values,
      };
    });

    // Pinecone recommends a limit of 100 vectors per upsert request
    const chunkSize = 50;
    for (let i = 0; i < pineconeVectors.length; i += chunkSize) {
      const chunk = pineconeVectors.slice(i, i + chunkSize);
      await this.pineconeIndex.upsert({
        upsertRequest: {
          vectors: chunk,
          namespace: this.namespace,
        },
      });
    }
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: PineconeMetadata
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
    metadatas: object[] | object,
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
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
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
