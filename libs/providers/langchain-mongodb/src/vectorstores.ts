import { type Collection, type Document as MongoDBDocument } from "mongodb";
import {
  MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";

/**
 * Stub embeddings for auto-embedding mode.
 * Throws if any embedding method is called, since the server handles embeddings.
 */
class AutoEmbeddingStub implements EmbeddingsInterface {
  async embedDocuments(_texts: string[]): Promise<number[][]> {
    throw new Error(
      "Embeddings not available when using auto-embedding mode. The MongoDB Atlas server handles all embedding generation."
    );
  }

  async embedQuery(_text: string): Promise<number[]> {
    throw new Error(
      "Embeddings not available when using auto-embedding mode. The MongoDB Atlas server handles all embedding generation."
    );
  }
}

/**
 * Type that defines the arguments required to initialize the
 * MongoDBAtlasVectorSearch class. It includes the MongoDB collection,
 * index name, text key, embedding key, primary key, and overwrite flag.
 *
 * @param collection MongoDB collection to store the vectors.
 * @param indexName A Collections Index Name.
 * @param textKey Corresponds to the plaintext of 'pageContent'.
 * @param embeddingKey Key to store the embedding under.
 * @param primaryKey The Key to use for upserting documents.
 */
export interface MongoDBAtlasVectorSearchLibArgs extends AsyncCallerParams {
  readonly collection: Collection<MongoDBDocument>;
  readonly indexName?: string;
  readonly textKey?: string;
  readonly embeddingKey?: string;
  readonly primaryKey?: string;
}

/**
 * Type that defines the filter used in the
 * similaritySearchVectorWithScore and maxMarginalRelevanceSearch methods.
 * It includes pre-filter, post-filter pipeline, and a flag to include
 * embeddings.
 */
type MongoDBAtlasFilter = {
  preFilter?: MongoDBDocument;
  postFilterPipeline?: MongoDBDocument[];
  includeEmbeddings?: boolean;
} & MongoDBDocument;

/**
 * Class that is a wrapper around MongoDB Atlas Vector Search. It is used
 * to store embeddings in MongoDB documents, create a vector search index,
 * and perform K-Nearest Neighbors (KNN) search with an approximate
 * nearest neighbor algorithm.
 */
export class MongoDBAtlasVectorSearch extends VectorStore {
  declare FilterType: MongoDBAtlasFilter;

  private readonly collection: Collection<MongoDBDocument>;

  private readonly indexName: string;

  private readonly textKey: string;

  private readonly embeddingKey: string;

  private readonly primaryKey: string;

  private caller: AsyncCaller;

  private readonly useAutoEmbedding: boolean;

  _vectorstoreType(): string {
    return "mongodb_atlas";
  }

  /**
   * Constructor with function overloads for backward compatibility.
   * (embeddings, args) - embeddings are provided by the user
   * (args) - the server handles embeddings
   */
  constructor(args: MongoDBAtlasVectorSearchLibArgs);
  constructor(
    embeddings: EmbeddingsInterface,
    args: MongoDBAtlasVectorSearchLibArgs
  );
  constructor(
    embeddingsOrDbConfig: EmbeddingsInterface | MongoDBAtlasVectorSearchLibArgs,
    args?: MongoDBAtlasVectorSearchLibArgs
  ) {
    let embeddings: EmbeddingsInterface;
    let libArgs: MongoDBAtlasVectorSearchLibArgs;
    let useAutoEmbedding = false;

    if (args !== undefined) {
      // (embeddings, args) - embeddings are provided by the user
      embeddings = embeddingsOrDbConfig as EmbeddingsInterface;
      libArgs = args;
    } else {
      // (args) - the server handles embeddings
      libArgs = embeddingsOrDbConfig as MongoDBAtlasVectorSearchLibArgs;
      // Set embeddings to a stub that throws if embedding methods are called, since the server handles embeddings in this mode
      embeddings = new AutoEmbeddingStub();
      useAutoEmbedding = true;
    }

    super(embeddings, libArgs);
    this.collection = libArgs.collection;
    this.indexName = libArgs.indexName ?? "default";
    this.textKey = libArgs.textKey ?? "text";
    this.embeddingKey = libArgs.embeddingKey ?? "embedding";
    this.primaryKey = libArgs.primaryKey ?? "_id";
    this.caller = new AsyncCaller(libArgs);
    this.useAutoEmbedding = useAutoEmbedding;
    this.collection.db.client.appendMetadata({
      name: "langchainjs_vector",
    });
  }

  /**
   * Method to add vectors and their corresponding documents to the MongoDB
   * collection.
   * @param vectors Vectors to be added.
   * @param documents Corresponding documents to be added.
   * @returns Promise that resolves when the vectors and documents have been added.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ) {
    if (this.useAutoEmbedding) {
      throw new Error(
        "Cannot add vectors directly when using auto-embedding mode."
      );
    }
    const docs = vectors.map((embedding, idx) => ({
      [this.textKey]: documents[idx].pageContent,
      [this.embeddingKey]: embedding,
      ...documents[idx].metadata,
    }));
    if (options?.ids === undefined) {
      await this.collection.insertMany(docs);
    } else {
      if (options.ids.length !== vectors.length) {
        throw new Error(
          `If provided, "options.ids" must be an array with the same length as "vectors".`
        );
      }
      const { ids } = options;
      for (let i = 0; i < docs.length; i += 1) {
        await this.caller.call(async () => {
          await this.collection.updateOne(
            { [this.primaryKey]: ids[i] },
            { $set: { [this.primaryKey]: ids[i], ...docs[i] } },
            { upsert: true }
          );
        });
      }
    }
    return options?.ids ?? docs.map((doc) => doc[this.primaryKey]);
  }

  /**
   * Method to add documents to the MongoDB collection.
   *
   * In manual embedding mode: converts documents to vectors using embeddings, then inserts.
   * In auto-embed mode: inserts documents with text only; MongoDB server handles embedding.
   *
   * @param documents Documents to be added.
   * @returns Promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[], options?: { ids?: string[] }) {
    if (this.useAutoEmbedding) {
      // Auto-embed mode: insert documents WITHOUT vectors
      // MongoDB auto-embedding index will read textKey and generate embeddings
      const docs = documents.map((document) => ({
        [this.textKey]: document.pageContent,
        ...document.metadata,
      }));

      if (options?.ids === undefined) {
        await this.collection.insertMany(docs);
      } else {
        if (options.ids.length !== documents.length) {
          throw new Error(
            `If provided, "options.ids" must be an array with the same length as "documents".`
          );
        }
        const { ids } = options;
        for (let i = 0; i < docs.length; i += 1) {
          await this.caller.call(async () => {
            await this.collection.updateOne(
              { [this.primaryKey]: ids[i] },
              { $set: { [this.primaryKey]: ids[i], ...docs[i] } },
              { upsert: true }
            );
          });
        }
      }
      return options?.ids ?? docs.map((doc) => doc[this.primaryKey]);
    } else {
      // Manual embedding mode: embed documents client-side then insert with vectors
      const texts = documents.map(({ pageContent }) => pageContent);
      return this.addVectors(
        await this.embeddings.embedDocuments(texts),
        documents,
        options
      );
    }
  }

  /**
   * Method that performs a similarity search on the vectors stored in the
   * MongoDB collection. It returns a list of documents and their
   * corresponding similarity scores.
   * @param query Query vector for the similarity search.
   * @param k Number of nearest neighbors to return.
   * @param filter Optional filter to be applied.
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: MongoDBAtlasFilter
  ): Promise<[Document, number][]> {
    if (this.useAutoEmbedding) {
      throw new Error(
        "Cannot perform similarity search with vectors directly when using auto-embedding mode."
      );
    }

    const postFilterPipeline = filter?.postFilterPipeline ?? [];
    const preFilter: MongoDBDocument | undefined =
      filter?.preFilter ||
      filter?.postFilterPipeline ||
      filter?.includeEmbeddings
        ? filter.preFilter
        : filter;
    const removeEmbeddingsPipeline = !filter?.includeEmbeddings
      ? [
          {
            $project: {
              [this.embeddingKey]: 0,
            },
          },
        ]
      : [];

    const pipeline: MongoDBDocument[] = [
      {
        $vectorSearch: {
          queryVector: MongoDBAtlasVectorSearch.fixArrayPrecision(query),
          index: this.indexName,
          path: this.embeddingKey,
          limit: k,
          numCandidates: 10 * k,
          ...(preFilter && { filter: preFilter }),
        },
      },
      {
        $set: {
          score: { $meta: "vectorSearchScore" },
        },
      },
      ...removeEmbeddingsPipeline,
      ...postFilterPipeline,
    ];

    const results = this.collection
      .aggregate(pipeline)
      .map<[Document, number]>((result) => {
        const { score, [this.textKey]: text, ...metadata } = result;
        return [new Document({ pageContent: text, metadata }), score];
      });

    return results.toArray();
  }

  /**
   * Performs similarity search using text-based queries (auto-embedding mode) or vector queries (manual embedding mode).
   * In auto-embed mode, the text query is sent to MongoDB which handles embedding server-side.
   * In manual embedding mode, the text is embedded client-side and passed as a vector.
   *
   * @param query - Text query for finding similar documents.
   * @param k - Number of similar results to return. Defaults to 4.
   * @param filter - Optional filter based on `FilterType`.
   * @returns A promise resolving to an array of tuples, each containing a
   *          document and its similarity score.
   */
  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    if (this.useAutoEmbedding) {
      // Auto-embed mode: use text-based $vectorSearch query
      return this.textBasedSearchWithScore(query, k, filter);
    }

    // Manual embedding mode: embed query client-side
    const queryEmbedding = await this.embeddings.embedQuery(query);
    return this.similaritySearchVectorWithScore(queryEmbedding, k, filter);
  }

  /**
   * Searches for documents similar to a text query by embedding the query and
   * performing a similarity search on the resulting vector.
   *
   * @param query - Text query for finding similar documents.
   * @param k - Number of similar results to return. Defaults to 4.
   * @param filter - Optional filter based on `FilterType`.
   * @returns A promise resolving to an array of `DocumentInterface` instances representing similar documents.
   */
  async similaritySearch(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<DocumentInterface[]> {
    const resultsWithScore = await this.similaritySearchWithScore(
      query,
      k ?? 4,
      filter
    );
    return resultsWithScore.map(([doc]) => doc);
  }

  private async textBasedSearchWithScore(
    query: string,
    k: number,
    filter?: MongoDBAtlasFilter
  ): Promise<[Document, number][]> {
    const postFilterPipeline = filter?.postFilterPipeline ?? [];
    const preFilter: MongoDBDocument | undefined =
      filter?.preFilter ||
      filter?.postFilterPipeline ||
      filter?.includeEmbeddings
        ? filter.preFilter
        : filter;
    const removeEmbeddingsPipeline = !filter?.includeEmbeddings
      ? [
          {
            $project: {
              [this.embeddingKey]: 0,
            },
          },
        ]
      : [];

    const pipeline: MongoDBDocument[] = [
      {
        $vectorSearch: {
          // Use text query with model for server-side embedding
          query: { text: query },
          index: this.indexName,
          path: this.textKey, // Search on the text field, not the embedding field
          limit: k,
          numCandidates: 10 * k,
          ...(preFilter && { filter: preFilter }),
        },
      },
      {
        $set: {
          score: { $meta: "vectorSearchScore" },
        },
      },
      ...removeEmbeddingsPipeline,
      ...postFilterPipeline,
    ];

    const results = this.collection
      .aggregate(pipeline)
      .map<[Document, number]>((result) => {
        const { score, [this.textKey]: text, ...metadata } = result;
        return [new Document({ pageContent: text, metadata }), score];
      });

    return results.toArray();
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND diversity
   * among selected documents.
   * Not supported in auto-embedding mode.
   * @param {string} query - Text to look up documents similar to.
   * @param {number} options.k - Number of documents to return.
   * @param {number} options.fetchK=20 - Number of documents to fetch before passing to the MMR algorithm (manual embedding mode only).
   * @param {number} options.lambda=0.5 - Number between 0 and 1 that determines the degree of diversity among the results,
   *                 where 0 corresponds to maximum diversity and 1 to minimum diversity.
   * @param {MongoDBAtlasFilter} options.filter - Optional Atlas Search operator to pre-filter on document fields
   *                                      or post-filter following the search.
   *
   * @returns {Promise<Document[]>} - List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    if (this.useAutoEmbedding) {
      throw new Error(
        "Cannot perform MMR search with vectors directly when using auto-embedding mode."
      );
    }

    const { k, fetchK = 20, lambda = 0.5, filter } = options;

    const queryEmbedding = await this.embeddings.embedQuery(query);

    // preserve the original value of includeEmbeddings
    const includeEmbeddingsFlag = options.filter?.includeEmbeddings || false;

    // update filter to include embeddings, as they will be used in MMR
    const includeEmbeddingsFilter = {
      ...filter,
      includeEmbeddings: true,
    };

    const resultDocs = await this.similaritySearchVectorWithScore(
      MongoDBAtlasVectorSearch.fixArrayPrecision(queryEmbedding),
      fetchK,
      includeEmbeddingsFilter
    );

    const embeddingList = resultDocs.map(
      (doc) => doc[0].metadata[this.embeddingKey]
    );

    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      lambda,
      k
    );

    return mmrIndexes.map((idx) => {
      const doc = resultDocs[idx][0];

      // remove embeddings if they were not requested originally
      if (!includeEmbeddingsFlag) {
        delete doc.metadata[this.embeddingKey];
      }
      return doc;
    });
  }

  /**
   * Delete documents from the collection
   * @param ids - An array of document IDs to be deleted from the collection.
   *
   * @returns - A promise that resolves when all documents deleted
   */
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  async delete(params: { ids: any[] }): Promise<void> {
    const CHUNK_SIZE = 50;
    const chunkIds: any[][] = chunkArray(params.ids, CHUNK_SIZE); // oxlint-disable-line @typescript-eslint/no-explicit-any
    for (const chunk of chunkIds)
      await this.collection.deleteMany({ _id: { $in: chunk } });
  }

  /**
   * Static method to create an instance of MongoDBAtlasVectorSearch from a
   * list of texts. It first converts the texts to vectors and then adds
   * them to the MongoDB collection.
   *
   * Supports two calling conventions for backward compatibility:
   * - `fromTexts(texts, metadatas, embeddings, dbConfig)` embeddings are provided by the user
   * - `fromTexts(texts, metadatas, dbConfig)` the server handles embeddings
   *
   * @param texts List of texts to be converted to vectors.
   * @param metadatas Metadata for the texts.
   * @param embeddings Embeddings to be used for conversion.
   * @param dbConfig Database configuration for MongoDB Atlas.
   * @returns Promise that resolves to a new instance of MongoDBAtlasVectorSearch.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: MongoDBAtlasVectorSearchLibArgs & { ids?: string[] }
  ): Promise<MongoDBAtlasVectorSearch>;
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    dbConfig: MongoDBAtlasVectorSearchLibArgs & { ids?: string[] }
  ): Promise<MongoDBAtlasVectorSearch>;
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddingsOrDbConfig:
      | EmbeddingsInterface
      | (MongoDBAtlasVectorSearchLibArgs & { ids?: string[] }),
    dbConfig?: MongoDBAtlasVectorSearchLibArgs & { ids?: string[] }
  ): Promise<MongoDBAtlasVectorSearch> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }

    // Detect which calling convention is being used
    if (dbConfig !== undefined) {
      // `fromTexts(texts, metadatas, embeddings, dbConfig)` embeddings provided by the user
      return this.fromDocuments(
        docs,
        embeddingsOrDbConfig as EmbeddingsInterface,
        dbConfig
      );
    } else {
      // `fromTexts(texts, metadatas, dbConfig)` the server handles embeddings
      return this.fromDocuments(
        docs,
        embeddingsOrDbConfig as MongoDBAtlasVectorSearchLibArgs & {
          ids?: string[];
        }
      );
    }
  }

  /**
   * Static method to create an instance of MongoDBAtlasVectorSearch from a
   * list of documents. It first converts the documents to vectors and then
   * adds them to the MongoDB collection.
   *
   * Supports three calling conventions for backward compatibility:
   * - `fromDocuments(docs, embeddings, dbConfig)` embeddings are provided by the user
   * - `fromDocuments(docs, dbConfig)` the server handles embeddings
   *
   * @param docs List of documents to be converted to vectors.
   * @param embeddingsOrDbConfig Embeddings to be used for conversion or the database configuration.
   * @param dbConfig Database configuration for MongoDB Atlas.
   * @returns Promise that resolves to a new instance of MongoDBAtlasVectorSearch.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: MongoDBAtlasVectorSearchLibArgs & { ids?: string[] }
  ): Promise<MongoDBAtlasVectorSearch>;
  static async fromDocuments(
    docs: Document[],
    dbConfig: MongoDBAtlasVectorSearchLibArgs & { ids?: string[] }
  ): Promise<MongoDBAtlasVectorSearch>;
  static async fromDocuments(
    docs: Document[],
    embeddingsOrDbConfig:
      | EmbeddingsInterface
      | (MongoDBAtlasVectorSearchLibArgs & { ids?: string[] }),
    dbConfig?: MongoDBAtlasVectorSearchLibArgs & { ids?: string[] }
  ): Promise<MongoDBAtlasVectorSearch> {
    let embeddings: EmbeddingsInterface;
    let finalDbConfig: MongoDBAtlasVectorSearchLibArgs & { ids?: string[] };

    let instance;
    // Detect which calling convention is being used
    if (dbConfig !== undefined) {
      // `fromDocuments(docs, embeddings, dbConfig)` embeddings provided by the user
      embeddings = embeddingsOrDbConfig as EmbeddingsInterface;
      finalDbConfig = dbConfig;
      instance = new this(embeddings, finalDbConfig);
    } else {
      // `fromDocuments(docs, dbConfig)` the server handles embeddings
      finalDbConfig =
        embeddingsOrDbConfig as MongoDBAtlasVectorSearchLibArgs & {
          ids?: string[];
        };
      instance = new this(finalDbConfig);
    }

    await instance.addDocuments(docs, { ids: finalDbConfig.ids });
    return instance;
  }

  /**
   * Static method to fix the precision of the array that ensures that
   * every number in this array is always float when casted to other types.
   * This is needed since MongoDB Atlas Vector Search does not cast integer
   * inside vector search to float automatically.
   * This method shall introduce a hint of error but should be safe to use
   * since introduced error is very small, only applies to integer numbers
   * returned by embeddings, and most embeddings shall not have precision
   * as high as 15 decimal places.
   * @param array Array of number to be fixed.
   * @returns
   */
  static fixArrayPrecision(array: number[]) {
    return array.map((value) => {
      if (Number.isInteger(value)) {
        return value + 0.000000000000001;
      }
      return value;
    });
  }
}
