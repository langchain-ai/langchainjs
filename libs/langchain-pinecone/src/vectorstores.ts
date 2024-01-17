import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

import {
  RecordMetadata,
  PineconeRecord,
  Index as PineconeIndex,
} from "@pinecone-database/pinecone";

import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";


// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
type PineconeMetadata = Record<string, any>;

/**
 * Database config for your vectorstore.
 */
export interface PineconeStoreParams extends AsyncCallerParams {
  pineconeIndex: PineconeIndex;
  textKey?: string;
  namespace?: string;
  filter?: PineconeMetadata;
}

/**
 * Class for managing and operating vector search applications with 
 * Pinecone, the cloud-native high-scale vector database 
 */
export class PineconeStore extends VectorStore {
  // Replace
  _vectorstoreType(): string {
    return "pinecone";
  }

  constructor(
    embeddings: EmbeddingsInterface,
    params: PineconeStoreParams
  ) {
    super(embeddings, params);
    this.embeddings = embeddings;
  }

  /**
 * Method to add an array of documents to the vectorstore.
 *
 * Useful to override in case your vectorstore doesn't work directly with embeddings.
 */
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] } | string[]
  ): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method to add raw vectors to the vectorstore.
   */
  async addVectors(
    _vectors: number[][],
    _documents: Document[],
    _options?: { ids?: string[] } | string[]
  ) {
    throw new Error("Not implemented.");
  }

  /**
   * Method to perform a similarity search over the vectorstore and return
   * the k most similar vectors along with their similarity scores.
   */
  async similaritySearchVectorWithScore(
    _query: number[],
    _k: number,
    _filter?: object
  ): Promise<[Document, number][]> {
    throw new Error("Not implemented.");
  }

  /**
   * Static method to create a new instance of the vectorstore from an
   * array of Document instances.
   *
   * Other common static initializer names are fromExistingIndex, initialize, and fromTexts.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: PineconeStoreParams
  ): Promise<PineconeStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
