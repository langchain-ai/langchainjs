/* eslint-disable no-process-env */
import * as uuid from "uuid";
import flatten from "flat";

import {
  RecordMetadata,
  PineconeRecord,
  Index as PineconeIndex,
} from "@pinecone-database/pinecone";

import {
  MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import { chunkArray } from "../utils/chunk.js";

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
type PineconeMetadata = Record<string, any>;

export interface PineconeLibArgs extends AsyncCallerParams {
  pineconeIndex: PineconeIndex;
  textKey?: string;
  namespace?: string;
  filter?: PineconeMetadata;
}

/**
 * Type that defines the parameters for the delete operation in the
 * PineconeStore class. It includes ids, filter, deleteAll flag, and namespace.
 */
export type PineconeDeleteParams = {
  ids?: string[];
  deleteAll?: boolean;
  filter?: object;
  namespace?: string;
};

/**
 * Class that extends the VectorStore class and provides methods to
 * interact with the Pinecone vector database.
 */
export class PineconeStore extends VectorStore {
  declare FilterType: PineconeMetadata;

  textKey: string;

  namespace?: string;

  pineconeIndex: PineconeIndex;

  filter?: PineconeMetadata;

  caller: AsyncCaller;

  _vectorstoreType(): string {
    return "pinecone";
  }

  constructor(embeddings: Embeddings, args: PineconeLibArgs) {
    super(embeddings, args);

    this.embeddings = embeddings;
    const { namespace, pineconeIndex, textKey, filter, ...asyncCallerArgs } =
      args;
    this.namespace = namespace;
    this.pineconeIndex = pineconeIndex;
    this.textKey = textKey ?? "text";
    this.filter = filter;
    this.caller = new AsyncCaller(asyncCallerArgs);
  }

  /**
   * Method that adds documents to the Pinecone database.
   * @param documents Array of documents to add to the Pinecone database.
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
   * Method that adds vectors to the Pinecone database.
   * @param vectors Array of vectors to add to the Pinecone database.
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
    const pineconeVectors = vectors.map((values, idx) => {
      // Pinecone doesn't support nested objects, so we flatten them
      const documentMetadata = { ...documents[idx].metadata };
      // preserve string arrays which are allowed
      const stringArrays: Record<string, string[]> = {};
      for (const key of Object.keys(documentMetadata)) {
        if (
          Array.isArray(documentMetadata[key]) &&
          // eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
          documentMetadata[key].every((el: any) => typeof el === "string")
        ) {
          stringArrays[key] = documentMetadata[key];
          delete documentMetadata[key];
        }
      }
      const metadata: {
        [key: string]: string | number | boolean | string[] | null;
      } = {
        ...flatten(documentMetadata),
        ...stringArrays,
        [this.textKey]: documents[idx].pageContent,
      };
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
      } as PineconeRecord<RecordMetadata>;
    });

    const namespace = this.pineconeIndex.namespace(this.namespace ?? "");
    // Pinecone recommends a limit of 100 vectors per upsert request
    const chunkSize = 100;
    const chunkedVectors = chunkArray(pineconeVectors, chunkSize);
    const batchRequests = chunkedVectors.map((chunk) =>
      this.caller.call(async () => namespace.upsert(chunk))
    );

    await Promise.all(batchRequests);

    return documentIds;
  }

  /**
   * Method that deletes vectors from the Pinecone database.
   * @param params Parameters for the delete operation.
   * @returns Promise that resolves when the delete operation is complete.
   */
  async delete(params: PineconeDeleteParams): Promise<void> {
    const { deleteAll, ids, filter } = params;
    const namespace = this.pineconeIndex.namespace(this.namespace ?? "");

    if (deleteAll) {
      await namespace.deleteAll();
    } else if (ids) {
      const batchSize = 1000;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        await namespace.deleteMany(batchIds);
      }
    } else if (filter) {
      await namespace.deleteMany(filter);
    } else {
      throw new Error("Either ids or delete_all must be provided.");
    }
  }

  protected async _runPineconeQuery(
    query: number[],
    k: number,
    filter?: PineconeMetadata,
    options?: { includeValues: boolean }
  ) {
    if (filter && this.filter) {
      throw new Error("cannot provide both `filter` and `this.filter`");
    }
    const _filter = filter ?? this.filter;
    const namespace = this.pineconeIndex.namespace(this.namespace ?? "");

    const results = await namespace.query({
      includeMetadata: true,
      topK: k,
      vector: query,
      filter: _filter,
      ...options,
    });

    return results;
  }

  /**
   * Method that performs a similarity search in the Pinecone database and
   * returns the results along with their scores.
   * @param query Query vector for the similarity search.
   * @param k Number of top results to return.
   * @param filter Optional filter to apply to the search.
   * @returns Promise that resolves with an array of documents and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: PineconeMetadata
  ): Promise<[Document, number][]> {
    const results = await this._runPineconeQuery(query, k, filter);
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

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND diversity
   * among selected documents.
   *
   * @param {string} query - Text to look up documents similar to.
   * @param {number} options.k - Number of documents to return.
   * @param {number} options.fetchK=20 - Number of documents to fetch before passing to the MMR algorithm.
   * @param {number} options.lambda=0.5 - Number between 0 and 1 that determines the degree of diversity among the results,
   *                 where 0 corresponds to maximum diversity and 1 to minimum diversity.
   * @param {PineconeMetadata} options.filter - Optional filter to apply to the search.
   *
   * @returns {Promise<Document[]>} - List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);

    const results = await this._runPineconeQuery(
      queryEmbedding,
      options.fetchK ?? 20,
      options.filter,
      { includeValues: true }
    );

    const matches = results?.matches ?? [];
    const embeddingList = matches.map((match) => match.values);

    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      options.lambda,
      options.k
    );

    const topMmrMatches = mmrIndexes.map((idx) => matches[idx]);

    const finalResult: Document[] = [];
    for (const res of topMmrMatches) {
      const { [this.textKey]: pageContent, ...metadata } = (res.metadata ??
        {}) as PineconeMetadata;
      if (res.score) {
        finalResult.push(new Document({ metadata, pageContent }));
      }
    }

    return finalResult;
  }

  /**
   * Static method that creates a new instance of the PineconeStore class
   * from texts.
   * @param texts Array of texts to add to the Pinecone database.
   * @param metadatas Metadata associated with the texts.
   * @param embeddings Embeddings to use for the texts.
   * @param dbConfig Configuration for the Pinecone database.
   * @returns Promise that resolves with a new instance of the PineconeStore class.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig:
      | {
          pineconeIndex: PineconeIndex;
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
      pineconeIndex: dbConfig.pineconeIndex,
      textKey: dbConfig.textKey,
      namespace: dbConfig.namespace,
    };
    return PineconeStore.fromDocuments(docs, embeddings, args);
  }

  /**
   * Static method that creates a new instance of the PineconeStore class
   * from documents.
   * @param docs Array of documents to add to the Pinecone database.
   * @param embeddings Embeddings to use for the documents.
   * @param dbConfig Configuration for the Pinecone database.
   * @returns Promise that resolves with a new instance of the PineconeStore class.
   */
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

  /**
   * Static method that creates a new instance of the PineconeStore class
   * from an existing index.
   * @param embeddings Embeddings to use for the documents.
   * @param dbConfig Configuration for the Pinecone database.
   * @returns Promise that resolves with a new instance of the PineconeStore class.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: PineconeLibArgs
  ): Promise<PineconeStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
