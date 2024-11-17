import * as uuid from "uuid";
import flatten from "flat";

import {
  RecordMetadata,
  PineconeRecord,
  Index as PineconeIndex,
  ScoredPineconeRecord,
} from "@pinecone-database/pinecone";

import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  VectorStore,
  type MaxMarginalRelevanceSearchOptions,
} from "@langchain/core/vectorstores";
import { Document, type DocumentInterface } from "@langchain/core/documents";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
type PineconeMetadata = Record<string, any>;

type HTTPHeaders = {
  [key: string]: string;
};

/**
 * Database config for your vectorstore.
 */
export interface PineconeStoreParams extends AsyncCallerParams {
  /**
   * The Pinecone index to use.
   * Either this or pineconeConfig must be provided.
   */
  pineconeIndex?: PineconeIndex;
  textKey?: string;
  namespace?: string;
  filter?: PineconeMetadata;
  /**
   * Configuration for the Pinecone index.
   * Either this or pineconeIndex must be provided.
   */
  pineconeConfig?: {
    indexName: ConstructorParameters<typeof PineconeIndex>[0];
    config: ConstructorParameters<typeof PineconeIndex>[1];
    namespace?: string;
    indexHostUrl?: string;
    additionalHeaders?: HTTPHeaders;
  };
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
 * Pinecone vector store integration.
 *
 * Setup:
 * Install `@langchain/pinecone` and `@pinecone-database/pinecone` to pass a client in.
 *
 * ```bash
 * npm install @langchain/pinecone @pinecone-database/pinecone
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/_langchain_pinecone.PineconeStore.html#constructor)
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { PineconeStore } from '@langchain/pinecone';
 * // Or other embeddings
 * import { OpenAIEmbeddings } from '@langchain/openai';
 *
 * import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
 *
 * const pinecone = new PineconeClient();
 *
 * // Will automatically read the PINECONE_API_KEY env var
 * const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
 *
 * const embeddings = new OpenAIEmbeddings({
 *   model: "text-embedding-3-small",
 * });
 *
 * const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
 *   pineconeIndex,
 *   // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
 *   maxConcurrency: 5,
 *   // You can pass a namespace here too
 *   // namespace: "foo",
 * });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Add documents</strong></summary>
 *
 * ```typescript
 * import type { Document } from '@langchain/core/documents';
 *
 * const document1 = { pageContent: "foo", metadata: { baz: "bar" } };
 * const document2 = { pageContent: "thud", metadata: { bar: "baz" } };
 * const document3 = { pageContent: "i will be deleted :(", metadata: {} };
 *
 * const documents: Document[] = [document1, document2, document3];
 * const ids = ["1", "2", "3"];
 * await vectorStore.addDocuments(documents, { ids });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Delete documents</strong></summary>
 *
 * ```typescript
 * await vectorStore.delete({ ids: ["3"] });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Similarity search</strong></summary>
 *
 * ```typescript
 * const results = await vectorStore.similaritySearch("thud", 1);
 * for (const doc of results) {
 *   console.log(`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
 * }
 * // Output: * thud [{"baz":"bar"}]
 * ```
 * </details>
 *
 * <br />
 *
 *
 * <details>
 * <summary><strong>Similarity search with filter</strong></summary>
 *
 * ```typescript
 * const resultsWithFilter = await vectorStore.similaritySearch("thud", 1, { baz: "bar" });
 *
 * for (const doc of resultsWithFilter) {
 *   console.log(`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
 * }
 * // Output: * foo [{"baz":"bar"}]
 * ```
 * </details>
 *
 * <br />
 *
 *
 * <details>
 * <summary><strong>Similarity search with score</strong></summary>
 *
 * ```typescript
 * const resultsWithScore = await vectorStore.similaritySearchWithScore("qux", 1);
 * for (const [doc, score] of resultsWithScore) {
 *   console.log(`* [SIM=${score.toFixed(6)}] ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
 * }
 * // Output: * [SIM=0.000000] qux [{"bar":"baz","baz":"bar"}]
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>As a retriever</strong></summary>
 *
 * ```typescript
 * const retriever = vectorStore.asRetriever({
 *   searchType: "mmr", // Leave blank for standard similarity search
 *   k: 1,
 * });
 * const resultAsRetriever = await retriever.invoke("thud");
 * console.log(resultAsRetriever);
 *
 * // Output: [Document({ metadata: { "baz":"bar" }, pageContent: "thud" })]
 * ```
 * </details>
 *
 * <br />
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

  constructor(embeddings: EmbeddingsInterface, params: PineconeStoreParams) {
    super(embeddings, params);
    this.embeddings = embeddings;

    const {
      namespace,
      pineconeIndex,
      textKey,
      filter,
      pineconeConfig,
      ...asyncCallerArgs
    } = params;
    this.namespace = namespace;
    if (!pineconeIndex && !pineconeConfig) {
      throw new Error("pineconeConfig or pineconeIndex must be provided.");
    }
    if (pineconeIndex && pineconeConfig) {
      throw new Error(
        "Only one of pineconeConfig or pineconeIndex can be provided."
      );
    }

    if (pineconeIndex) {
      this.pineconeIndex = pineconeIndex;
    } else if (pineconeConfig) {
      this.pineconeIndex = new PineconeIndex(
        pineconeConfig.indexName,
        {
          ...pineconeConfig.config,
          sourceTag: "langchainjs",
        },
        pineconeConfig.namespace,
        pineconeConfig.indexHostUrl,
        pineconeConfig.additionalHeaders
      );
    }

    this.textKey = textKey ?? "text";
    this.filter = filter;
    this.caller = new AsyncCaller(asyncCallerArgs);
  }

  /**
   * Method that adds documents to the Pinecone database.
   *
   * @param documents Array of documents to add to the Pinecone database.
   * @param options Optional ids for the documents.
   * @returns Promise that resolves with the ids of the added documents.
   */
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[]; namespace?: string } | string[]
  ): Promise<string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method that adds vectors to the Pinecone database.
   *
   * @param vectors Array of vectors to add to the Pinecone database.
   * @param documents Array of documents associated with the vectors.
   * @param options Optional ids for the vectors.
   * @returns Promise that resolves with the ids of the added vectors.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[]; namespace?: string } | string[]
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

    const optionsNamespace =
      !Array.isArray(options) && options?.namespace
        ? options.namespace
        : this.namespace;
    const namespace = this.pineconeIndex.namespace(optionsNamespace ?? "");
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
    const optionsNamespace = params.namespace ?? this.namespace;
    const namespace = this.pineconeIndex.namespace(optionsNamespace ?? "");

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

    let optionsNamespace = this.namespace ?? "";
    if (_filter && "namespace" in _filter) {
      optionsNamespace = _filter.namespace;
      delete _filter.namespace;
    }

    const namespace = this.pineconeIndex.namespace(optionsNamespace ?? "");

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
   * Format the matching results from the Pinecone query.
   * @param matches Matching results from the Pinecone query.
   * @returns An array of arrays, where each inner array contains a document and its score.
   */
  private _formatMatches(
    matches: ScoredPineconeRecord<RecordMetadata>[] = []
  ): [Document, number][] {
    const documentsWithScores: [Document, number][] = [];

    for (const record of matches) {
      const {
        id,
        score,
        metadata: { [this.textKey]: pageContent, ...metadata } = {
          [this.textKey]: "",
        },
      } = record;

      if (score) {
        documentsWithScores.push([
          new Document({
            id,
            pageContent: pageContent?.toString() ?? "",
            metadata,
          }),
          score,
        ]);
      }
    }

    return documentsWithScores;
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
    const { matches = [] } = await this._runPineconeQuery(query, k, filter);
    const records = this._formatMatches(matches);

    return records;
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
   * @returns {Promise<DocumentInterface[]>} - List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<DocumentInterface[]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);

    const results = await this._runPineconeQuery(
      queryEmbedding,
      options.fetchK ?? 20,
      options.filter,
      { includeValues: true }
    );

    const { matches = [] } = results;
    const embeddingList = matches.map((match) => match.values);

    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      options.lambda,
      options.k
    );

    const topMmrMatches = mmrIndexes.map((idx) => matches[idx]);
    const records = this._formatMatches(topMmrMatches);
    return records.map(([doc, _score]) => doc);
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
    embeddings: EmbeddingsInterface,
    dbConfig:
      | {
          pineconeIndex: PineconeIndex;
          textKey?: string;
          namespace?: string | undefined;
        }
      | PineconeStoreParams
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

    const args: PineconeStoreParams = {
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
    embeddings: EmbeddingsInterface,
    dbConfig: PineconeStoreParams
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
    embeddings: EmbeddingsInterface,
    dbConfig: PineconeStoreParams
  ): Promise<PineconeStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}
