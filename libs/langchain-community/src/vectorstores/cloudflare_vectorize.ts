import * as uuid from "uuid";

import {
  VectorizeIndex,
  VectorizeVectorMetadata,
} from "@cloudflare/workers-types";
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import {
  AsyncCaller,
  type AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { chunkArray } from "../utils/chunk.js";

export interface VectorizeLibArgs extends AsyncCallerParams {
  index: VectorizeIndex;
  textKey?: string;
}

/**
 * Type that defines the parameters for the delete operation in the
 * CloudflareVectorizeStore class. It includes ids, deleteAll flag, and namespace.
 */
export type VectorizeDeleteParams = {
  ids: string[];
};

/**
 * Class that extends the VectorStore class and provides methods to
 * interact with the Cloudflare Vectorize vector database.
 */
export class CloudflareVectorizeStore extends VectorStore {
  textKey: string;

  namespace?: string;

  index: VectorizeIndex;

  caller: AsyncCaller;

  _vectorstoreType(): string {
    return "cloudflare_vectorize";
  }

  constructor(embeddings: Embeddings, args: VectorizeLibArgs) {
    super(embeddings, args);

    this.embeddings = embeddings;
    const { index, textKey, ...asyncCallerArgs } = args;
    if (!index) {
      throw new Error(
        "Must supply a Vectorize index binding, eg { index: env.VECTORIZE }"
      );
    }
    this.index = index;
    this.textKey = textKey ?? "text";
    this.caller = new AsyncCaller({
      maxConcurrency: 6,
      maxRetries: 0,
      ...asyncCallerArgs,
    });
  }

  /**
   * Method that adds documents to the Vectorize database.
   * @param documents Array of documents to add.
   * @param options Optional ids for the documents.
   * @returns Promise that resolves with the ids of the added documents.
   */
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] } | string[]
  ) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method that adds vectors to the Vectorize database.
   * @param vectors Array of vectors to add.
   * @param documents Array of documents associated with the vectors.
   * @param options Optional ids for the vectors.
   * @returns Promise that resolves with the ids of the added vectors.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] } | string[]
  ) {
    const ids = Array.isArray(options) ? options : options?.ids;
    const documentIds = ids == null ? documents.map(() => uuid.v4()) : ids;
    const vectorizeVectors = vectors.map((values, idx) => {
      const metadata: Record<string, VectorizeVectorMetadata> = {
        ...documents[idx].metadata,
        [this.textKey]: documents[idx].pageContent,
      };
      return {
        id: documentIds[idx],
        metadata,
        values,
      };
    });

    // Stick to a limit of 500 vectors per upsert request
    const chunkSize = 500;
    const chunkedVectors = chunkArray(vectorizeVectors, chunkSize);
    const batchRequests = chunkedVectors.map((chunk) =>
      this.caller.call(async () => this.index.upsert(chunk))
    );

    await Promise.all(batchRequests);

    return documentIds;
  }

  /**
   * Method that deletes vectors from the Vectorize database.
   * @param params Parameters for the delete operation.
   * @returns Promise that resolves when the delete operation is complete.
   */
  async delete(params: VectorizeDeleteParams): Promise<void> {
    const batchSize = 1000;
    const batchedIds = chunkArray(params.ids, batchSize);
    const batchRequests = batchedIds.map((batchIds) =>
      this.caller.call(async () => this.index.deleteByIds(batchIds))
    );
    await Promise.all(batchRequests);
  }

  /**
   * Method that performs a similarity search in the Vectorize database and
   * returns the results along with their scores.
   * @param query Query vector for the similarity search.
   * @param k Number of top results to return.
   * @returns Promise that resolves with an array of documents and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    const results = await this.index.query(query, {
      returnVectors: true,
      topK: k,
    });

    const result: [Document, number][] = [];

    if (results.matches) {
      for (const res of results.matches) {
        const { [this.textKey]: pageContent, ...metadata } =
          res.vector?.metadata ?? {};
        result.push([
          new Document({ metadata, pageContent: pageContent as string }),
          res.score,
        ]);
      }
    }

    return result;
  }

  /**
   * Static method that creates a new instance of the CloudflareVectorizeStore class
   * from texts.
   * @param texts Array of texts to add to the Vectorize database.
   * @param metadatas Metadata associated with the texts.
   * @param embeddings Embeddings to use for the texts.
   * @param dbConfig Configuration for the Vectorize database.
   * @param options Optional ids for the vectors.
   * @returns Promise that resolves with a new instance of the CloudflareVectorizeStore class.
   */
  static async fromTexts(
    texts: string[],
    metadatas:
      | Record<string, VectorizeVectorMetadata>[]
      | Record<string, VectorizeVectorMetadata>,
    embeddings: Embeddings,
    dbConfig: VectorizeLibArgs
  ): Promise<CloudflareVectorizeStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return CloudflareVectorizeStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method that creates a new instance of the CloudflareVectorizeStore class
   * from documents.
   * @param docs Array of documents to add to the Vectorize database.
   * @param embeddings Embeddings to use for the documents.
   * @param dbConfig Configuration for the Vectorize database.
   * @param options Optional ids for the vectors.
   * @returns Promise that resolves with a new instance of the CloudflareVectorizeStore class.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: VectorizeLibArgs
  ): Promise<CloudflareVectorizeStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Static method that creates a new instance of the CloudflareVectorizeStore class
   * from an existing index.
   * @param embeddings Embeddings to use for the documents.
   * @param dbConfig Configuration for the Vectorize database.
   * @returns Promise that resolves with a new instance of the CloudflareVectorizeStore class.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: VectorizeLibArgs
  ): Promise<CloudflareVectorizeStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
