import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  Container,
  ContainerRequest,
  CosmosClient,
  CosmosClientOptions,
  DatabaseRequest,
  FullTextPolicy,
  IndexingPolicy,
  SqlParameter,
  SqlQuerySpec,
  VectorEmbedding,
  VectorEmbeddingPolicy,
  VectorIndex,
} from "@azure/cosmos";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";

/** Azure Cosmos DB for NoSQL search types. */
export const AzureCosmosDBNoSQLSearchType = {
  /** Vector similarity search. */
  Vector: "vector",
  /** Vector search with score threshold filtering. */
  VectorScoreThreshold: "vector_score_threshold",
  /** Full-text search only (preview feature). */
  FullTextSearch: "full_text_search",
  /** Full-text search with BM25 ranking (preview feature). */
  FullTextRanking: "full_text_ranking",
  /** Hybrid search combining vector and full-text search with RRF (preview feature). */
  Hybrid: "hybrid",
  /** Hybrid search with score threshold filtering (preview feature). */
  HybridScoreThreshold: "hybrid_score_threshold",
} as const;

/** Azure Cosmos DB for NoSQL search type. */
export type AzureCosmosDBNoSQLSearchType =
  (typeof AzureCosmosDBNoSQLSearchType)[keyof typeof AzureCosmosDBNoSQLSearchType];

/** Re-export FullTextPolicy and VectorIndex types from @azure/cosmos for convenience. */
export type { FullTextPolicy, VectorIndex } from "@azure/cosmos";

/**
 * Full-text rank filter item for full-text ranking queries.
 * Each item specifies a field to search and the search text.
 */
export interface AzureCosmosDBNoSQLFullTextRankFilter {
  /** The field to search. */
  searchField: string;
  /** The search text. */
  searchText: string;
}

/**
 * Projection mapping for custom field selection.
 * Maps field names to their aliases in the query results.
 */
export type ProjectionMapping = Record<string, string>;

/** Azure Cosmos DB for NoSQL query filter. */
export type AzureCosmosDBNoSQLQueryFilter = string | SqlQuerySpec;

/** Azure Cosmos DB for NoSQL filter type. */
export type AzureCosmosDBNoSQLFilterType = {
  /**
   * SQL filter clause to add to the search query.
   * @example 'WHERE c.category = "cars"'
   */
  filterClause?: AzureCosmosDBNoSQLQueryFilter;
  /** Determines whether or not to include the embeddings in the search results. */
  includeEmbeddings?: boolean;
  /** Search type override for this query. Takes precedence over the default search type. */
  searchType?: AzureCosmosDBNoSQLSearchType;
  /**
   * Full-text rank filter for full-text ranking queries.
   * Each item specifies a field to search and the search text.
   */
  fullTextRankFilter?: AzureCosmosDBNoSQLFullTextRankFilter[];
  /**
   * Projection mapping for custom field selection.
   * Maps field names to their paths in the document.
   */
  projectionMapping?: ProjectionMapping;
  /**
   * Offset and limit clause for pagination.
   * @example 'OFFSET 10 LIMIT 20'
   */
  offsetLimit?: string;
  /**
   * Weights for hybrid search RRF (Reciprocal Rank Fusion).
   * Typically two values: [vectorWeight, fullTextWeight].
   */
  weights?: number[];
  /**
   * Score threshold for filtering results.
   * Only results with a score >= threshold are returned.
   */
  threshold?: number;
};

/** Azure Cosmos DB for NoSQL Delete Parameters. */
export type AzureCosmosDBNoSqlDeleteParams = {
  /** List of IDs for the documents to be removed. */
  readonly ids?: string | string[];
  /** SQL query to select the documents to be removed. */
  readonly filter?: AzureCosmosDBNoSQLQueryFilter;
};

/** Azure Cosmos DB for NoSQL database creation options. */
export type AzureCosmosDBNoSqlCreateDatabaseOptions = Partial<
  Omit<DatabaseRequest, "id">
>;
/** Azure Cosmos DB for NoSQL container creation options. */
export type AzureCosmosDBNoSqlCreateContainerOptions = Partial<
  Omit<ContainerRequest, "id" | "vectorEmbeddingPolicy" | "indexingPolicy">
>;

/**
 * Initialization options for the Azure CosmosDB for NoSQL database and container.
 *
 * Note that if you provide multiple vector embeddings in the vectorEmbeddingPolicy,
 * the first one will be used for creating documents and searching.
 */
export interface AzureCosmosDBNoSQLInitOptions {
  readonly vectorEmbeddingPolicy?: VectorEmbeddingPolicy;
  readonly indexingPolicy?: IndexingPolicy;
  /**
   * Full-text policy for the container (preview feature).
   * Required when fullTextSearchEnabled is true.
   */
  readonly fullTextPolicy?: FullTextPolicy;
  readonly createContainerOptions?: AzureCosmosDBNoSqlCreateContainerOptions;
  readonly createDatabaseOptions?: AzureCosmosDBNoSqlCreateDatabaseOptions;
}

/**
 * Configuration options for the `AzureCosmosDBNoSQLVectorStore` constructor.
 */
export interface AzureCosmosDBNoSQLConfig extends AzureCosmosDBNoSQLInitOptions {
  /** Pre-configured CosmosClient instance. If provided, connectionString and endpoint are ignored. */
  readonly client?: CosmosClient;
  /** Cosmos DB connection string. */
  readonly connectionString?: string;
  /** Cosmos DB endpoint URL (used with credentials for Azure AD authentication). */
  readonly endpoint?: string;
  /** Azure credential for authentication (defaults to DefaultAzureCredential). */
  readonly credentials?: TokenCredential;
  /** Database name. Defaults to "vectorSearchDB". */
  readonly databaseName?: string;
  /** Container name. Defaults to "vectorSearchContainer". */
  readonly containerName?: string;
  /** Document field name for the text content. Defaults to "text". */
  readonly textKey?: string;
  /** Document field name for the metadata. Defaults to "metadata". */
  readonly metadataKey?: string;
  /**
   * Enable full-text search capabilities (preview feature).
   * When enabled, fullTextPolicy and appropriate indexingPolicy must be configured.
   */
  readonly fullTextSearchEnabled?: boolean;
  /** Table alias used in Cosmos DB SQL queries. Defaults to "c". */
  readonly tableAlias?: string;
  /**
   * Default search type to use when no search type is specified in the filter.
   * Defaults to "vector".
   */
  readonly defaultSearchType?: AzureCosmosDBNoSQLSearchType;
}

const USER_AGENT_SUFFIX = "langchainjs-cdbnosql-vectorstore-javascript";

/**
 * Azure Cosmos DB for NoSQL vector store.
 * To use this, you should have both:
 * - the `@azure/cosmos` NPM package installed
 * - a connection string associated with a NoSQL instance
 *
 * You do not need to create a database or container, it will be created
 * automatically.
 *
 * @example
 * ```typescript
 * const vectorStore = new AzureCosmosDBNoSQLVectorStore(
 *   new OpenAIEmbeddings(),
 *   {
 *     databaseName: "mydb",
 *     containerName: "vectors",
 *   }
 * );
 * await vectorStore.addDocuments(docs);
 * const results = await vectorStore.similaritySearch("query", 4);
 * ```
 */
export class AzureCosmosDBNoSQLVectorStore extends VectorStore {
  declare FilterType: AzureCosmosDBNoSQLFilterType;

  get lc_secrets(): { [key: string]: string } {
    return {
      connectionString: "AZURE_COSMOSDB_NOSQL_CONNECTION_STRING",
    };
  }

  private initPromise?: Promise<void>;

  private readonly client: CosmosClient;

  private container: Container;

  private readonly textKey: string;

  private readonly metadataKey: string;

  private embeddingKey: string;

  private readonly fullTextSearchEnabled: boolean;

  private readonly tableAlias: string;

  private readonly fullTextPolicy?: FullTextPolicy;

  private readonly defaultSearchType: AzureCosmosDBNoSQLSearchType;

  /**
   * Initializes the AzureCosmosDBNoSQLVectorStore.
   * Connects the client to the database and creates the container if needed.
   * @returns A promise that resolves when the AzureCosmosDBNoSQLVectorStore has been initialized.
   */
  initialize: () => Promise<void>;

  _vectorstoreType(): string {
    return "azure_cosmosdb_nosql";
  }

  constructor(
    embeddings: EmbeddingsInterface,
    dbConfig: AzureCosmosDBNoSQLConfig
  ) {
    super(embeddings, dbConfig);

    const connectionString =
      dbConfig.connectionString ??
      getEnvironmentVariable("AZURE_COSMOSDB_NOSQL_CONNECTION_STRING");

    const endpoint =
      dbConfig.endpoint ??
      getEnvironmentVariable("AZURE_COSMOSDB_NOSQL_ENDPOINT");

    if (!dbConfig.client && !connectionString && !endpoint) {
      throw new Error(
        "AzureCosmosDBNoSQLVectorStore client, connection string or endpoint must be set."
      );
    }

    if (!dbConfig.client) {
      if (connectionString) {
        this.client = new CosmosClient({
          connectionString,
          userAgentSuffix: USER_AGENT_SUFFIX,
        });
      } else {
        // Use managed identity
        this.client = new CosmosClient({
          endpoint,
          aadCredentials: dbConfig.credentials ?? new DefaultAzureCredential(),
          userAgentSuffix: USER_AGENT_SUFFIX,
        } as CosmosClientOptions);
      }
    }

    const client = dbConfig.client || this.client;
    const databaseName = dbConfig.databaseName ?? "vectorSearchDB";
    const containerName = dbConfig.containerName ?? "vectorSearchContainer";
    this.textKey = dbConfig.textKey ?? "text";
    this.metadataKey = dbConfig.metadataKey ?? "metadata";
    this.fullTextSearchEnabled = dbConfig.fullTextSearchEnabled ?? false;
    this.tableAlias = dbConfig.tableAlias ?? "c";
    this.fullTextPolicy = dbConfig.fullTextPolicy;
    this.defaultSearchType =
      dbConfig.defaultSearchType ?? AzureCosmosDBNoSQLSearchType.Vector;

    const vectorEmbeddingPolicy = dbConfig.vectorEmbeddingPolicy ?? {
      vectorEmbeddings: [],
    };
    const indexingPolicy = dbConfig.indexingPolicy ?? {
      indexingMode: "consistent",
      automatic: true,
      includedPaths: [{ path: "/*" }],
      excludedPaths: [{ path: "/_etag/?" }],
    };

    if (vectorEmbeddingPolicy.vectorEmbeddings.length === 0) {
      vectorEmbeddingPolicy.vectorEmbeddings = [
        {
          path: "/vector",
          dataType: "float32",
          distanceFunction: "cosine",
          // Will be determined automatically during initialization
          dimensions: 0,
        } as VectorEmbedding,
      ];
    }

    if (!indexingPolicy.vectorIndexes?.length) {
      indexingPolicy.vectorIndexes = [
        {
          path: "/vector",
          type: "quantizedFlat",
        } as VectorIndex,
      ];
    }

    this.embeddingKey = vectorEmbeddingPolicy.vectorEmbeddings[0].path.slice(1);
    if (!this.embeddingKey) {
      throw new Error(
        "AzureCosmosDBNoSQLVectorStore requires a valid vectorEmbeddings path"
      );
    }

    // Validate full-text search configuration
    if (this.fullTextSearchEnabled) {
      if (
        !indexingPolicy.fullTextIndexes ||
        indexingPolicy.fullTextIndexes.length === 0
      ) {
        throw new Error(
          "fullTextIndexes cannot be null or empty in the indexingPolicy if full text search is enabled."
        );
      }
      if (
        !this.fullTextPolicy ||
        !this.fullTextPolicy.fullTextPaths ||
        this.fullTextPolicy.fullTextPaths.length === 0
      ) {
        throw new Error(
          "fullTextPolicy with fullTextPaths cannot be null or empty if full text search is enabled."
        );
      }
    }

    // Deferring initialization to the first call to `initialize`
    this.initialize = () => {
      if (this.initPromise === undefined) {
        this.initPromise = this.init(client, databaseName, containerName, {
          vectorEmbeddingPolicy,
          indexingPolicy,
          fullTextPolicy: this.fullTextPolicy,
          createContainerOptions: dbConfig.createContainerOptions,
          createDatabaseOptions: dbConfig.createDatabaseOptions,
        }).catch((error) => {
          console.error(
            "Error during AzureCosmosDBNoSQLVectorStore initialization:",
            error
          );
        });
      }

      return this.initPromise;
    };
  }

  /**
   * Removes specified documents from the AzureCosmosDBNoSQLVectorStore.
   * If no IDs or filter are specified, all documents will be removed.
   * @param params Parameters for the delete operation.
   * @returns A promise that resolves when the documents have been removed.
   */
  async delete(params: AzureCosmosDBNoSqlDeleteParams = {}): Promise<void> {
    await this.initialize();

    if (params.ids && params.filter) {
      throw new Error(
        `AzureCosmosDBNoSQLVectorStore delete requires either "ids" or "filter" to be set in the params object, not both`
      );
    }

    let ids: string[];
    let query: AzureCosmosDBNoSQLQueryFilter | undefined = params.filter;

    // Delete all documents
    if (!params.ids && !params.filter) {
      query = "SELECT c.id FROM c";
    }

    if (query) {
      const { resources } = await this.container.items.query(query).fetchAll();
      ids = resources.map((item) => item.id);
    } else {
      ids = (Array.isArray(params.ids) ? params.ids : [params.ids]) as string[];
    }

    if (ids.length === 0) {
      return;
    }

    await Promise.all(ids.map((id) => this.container.item(id, id).delete()));
  }

  /**
   * Gets the underlying Cosmos DB container.
   * Useful for performing direct operations on the container.
   * @returns The Cosmos DB container instance.
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Method for adding vectors to the AzureCosmosDBNoSQLVectorStore.
   * @param vectors Vectors to be added.
   * @param documents Corresponding documents to be added.
   * @returns A promise that resolves to the added documents IDs.
   */
  async addVectors(
    vectors: number[][],
    documents: DocumentInterface[]
  ): Promise<string[]> {
    await this.initialize();
    const docs = vectors.map((embedding, idx) => ({
      [this.textKey]: documents[idx].pageContent,
      [this.embeddingKey]: embedding,
      [this.metadataKey]: documents[idx].metadata,
      ...(documents[idx].id ? { id: documents[idx].id } : {}),
    }));

    const ids: string[] = [];
    const results = await Promise.all(
      docs.map((doc) => this.container.items.create(doc))
    );

    for (const result of results) {
      ids.push(result.resource?.id ?? "error: could not create item");
    }

    return ids;
  }

  /**
   * Method for adding documents to the AzureCosmosDBNoSQLVectorStore. It first converts
   * the documents to texts and then adds them as vectors.
   * @param documents The documents to add.
   * @returns A promise that resolves to the added documents IDs.
   */
  async addDocuments(documents: DocumentInterface[]): Promise<string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Performs a similarity search on the vectors stored in the container.
   * Routes to the appropriate search implementation based on the search type
   * specified in the filter or the default search type configured for the vector store.
   * @param queryVector Query vector for the similarity search.
   * @param k Number of nearest neighbors to return. Defaults to 4.
   * @param filter Optional filter options for the documents.
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
   */
  async similaritySearchVectorWithScore(
    queryVector: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    const searchType = filter?.searchType ?? this.defaultSearchType;

    if (searchType === AzureCosmosDBNoSQLSearchType.Vector) {
      return this.vectorSearchWithScore(queryVector, k, filter);
    } else if (
      searchType === AzureCosmosDBNoSQLSearchType.VectorScoreThreshold
    ) {
      return this.vectorSearchWithScoreThreshold(
        queryVector,
        k,
        filter,
        filter?.threshold
      );
    } else if (searchType === AzureCosmosDBNoSQLSearchType.Hybrid) {
      if (
        !filter?.fullTextRankFilter ||
        filter.fullTextRankFilter.length === 0
      ) {
        throw new Error(
          `fullTextRankFilter is required for ${searchType} search type`
        );
      }
      return this.hybridSearchWithScore(
        queryVector,
        k,
        filter,
        filter.fullTextRankFilter
      );
    } else if (
      searchType === AzureCosmosDBNoSQLSearchType.HybridScoreThreshold
    ) {
      if (
        !filter?.fullTextRankFilter ||
        filter.fullTextRankFilter.length === 0
      ) {
        throw new Error(
          `fullTextRankFilter is required for ${searchType} search type`
        );
      }
      return this.hybridSearchWithScoreThreshold(
        queryVector,
        k,
        filter,
        filter.fullTextRankFilter,
        filter?.threshold
      );
    } else if (searchType === AzureCosmosDBNoSQLSearchType.FullTextSearch) {
      return this.fullTextSearch(k, filter);
    } else if (searchType === AzureCosmosDBNoSQLSearchType.FullTextRanking) {
      if (!filter?.fullTextRankFilter) {
        throw new Error(
          `fullTextRankFilter is required for ${searchType} search type`
        );
      }
      return this.fullTextRanking(k, filter, filter.fullTextRankFilter);
    }
    throw new Error(`Unrecognized search type '${searchType}'`);
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND
   * diversity among selected documents.
   * @param query Text to look up documents similar to.
   * @param options.k Number of documents to return.
   * @param options.fetchK Number of documents to fetch before passing to
   *     the MMR algorithm. Defaults to 20.
   * @param options.lambda Number between 0 and 1 that determines the
   *     degree of diversity among the results, where 0 corresponds to maximum
   *     diversity and 1 to minimum diversity. Defaults to 0.5.
   * @returns List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    return this.maxMarginalRelevanceSearchByVector(queryEmbedding, options);
  }

  /**
   * Return documents selected using the maximal marginal relevance from a vector.
   * Maximal marginal relevance optimizes for similarity to the query AND
   * diversity among selected documents.
   * @param queryEmbedding Query embedding vector.
   * @param options.k Number of documents to return.
   * @param options.fetchK Number of documents to fetch before passing to
   *     the MMR algorithm. Defaults to 20.
   * @param options.lambda Number between 0 and 1 that determines the
   *     degree of diversity among the results, where 0 corresponds to maximum
   *     diversity and 1 to minimum diversity. Defaults to 0.5.
   * @returns List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearchByVector(
    queryEmbedding: number[],
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    const { k, fetchK = 20, lambda = 0.5, filter } = options;
    const includeEmbeddingsFlag = filter?.includeEmbeddings || false;

    const docs = await this.similaritySearchVectorWithScore(
      queryEmbedding,
      fetchK,
      {
        ...filter,
        includeEmbeddings: true,
      }
    );
    const embeddingList = docs.map((doc) => doc[0].metadata[this.embeddingKey]);

    // Re-rank the results using MMR
    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      lambda,
      k
    );

    return mmrIndexes.map((index) => {
      const doc = docs[index][0];

      // Remove embeddings if they were not requested originally
      if (!includeEmbeddingsFlag) {
        delete doc.metadata[this.embeddingKey];
      }
      return doc;
    });
  }

  /**
   * Initializes the AzureCosmosDBNoSQLVectorStore by connecting to the database.
   * @param client The CosmosClient to use for connecting to the database.
   * @param databaseName The name of the database to use.
   * @param containerName The name of the container to use.
   * @param initOptions Initialization options for the database and container.
   * @returns A promise that resolves when the AzureCosmosDBNoSQLVectorStore has been initialized.
   */
  private async init(
    client: CosmosClient,
    databaseName: string,
    containerName: string,
    initOptions: AzureCosmosDBNoSQLInitOptions
  ): Promise<void> {
    // Determine vector dimensions if not provided
    const vectorEmbeddingPolicy = initOptions.vectorEmbeddingPolicy!;
    const needDimensions = vectorEmbeddingPolicy.vectorEmbeddings.some(
      (v) => !v.dimensions
    );
    if (needDimensions) {
      const queryEmbedding = await this.embeddings.embedQuery("test");
      for (const v of vectorEmbeddingPolicy.vectorEmbeddings) {
        if (!v.dimensions) {
          v.dimensions = queryEmbedding.length;
        }
      }
    }

    const { database } = await client.databases.createIfNotExists({
      ...(initOptions?.createDatabaseOptions ?? {}),
      id: databaseName,
    });

    const containerOptions = initOptions?.createContainerOptions ?? {};
    const { container } = await database.containers.createIfNotExists({
      ...containerOptions,
      // Default partition key to /id if not specified
      partitionKey: containerOptions.partitionKey ?? "/id",
      indexingPolicy: initOptions?.indexingPolicy,
      vectorEmbeddingPolicy,
      fullTextPolicy: initOptions?.fullTextPolicy,
      id: containerName,
    });
    this.container = container;
  }

  /**
   * Performs a plain vector similarity search.
   */
  private async vectorSearchWithScore(
    queryVector: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    await this.initialize();

    const { query, parameters } = this.constructQuery(
      k,
      AzureCosmosDBNoSQLSearchType.Vector,
      {
        embeddings: queryVector,
        filterClause: filter?.filterClause,
        offsetLimit: filter?.offsetLimit,
        projectionMapping: filter?.projectionMapping,
        withEmbedding: filter?.includeEmbeddings,
      }
    );

    return this.executeQuery(
      query,
      AzureCosmosDBNoSQLSearchType.Vector,
      parameters,
      {
        withEmbedding: filter?.includeEmbeddings,
        projectionMapping: filter?.projectionMapping,
      }
    );
  }

  /**
   * Performs hybrid search combining vector similarity and full-text search using RRF.
   */
  private async hybridSearchWithScore(
    embeddings: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    fullTextRankFilter: AzureCosmosDBNoSQLFullTextRankFilter[]
  ): Promise<[Document, number][]> {
    const { query, parameters } = this.constructQuery(
      k,
      AzureCosmosDBNoSQLSearchType.Hybrid,
      {
        embeddings,
        fullTextRankFilter,
        offsetLimit: filter?.offsetLimit,
        projectionMapping: filter?.projectionMapping,
        withEmbedding: filter?.includeEmbeddings,
        filterClause: filter?.filterClause,
        weights: filter?.weights,
      }
    );

    return this.executeQuery(
      query,
      AzureCosmosDBNoSQLSearchType.Hybrid,
      parameters,
      {
        withEmbedding: filter?.includeEmbeddings,
        projectionMapping: filter?.projectionMapping,
      }
    );
  }

  /**
   * Performs hybrid search with score threshold filtering.
   */
  private async hybridSearchWithScoreThreshold(
    embeddings: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    fullTextRankFilter: AzureCosmosDBNoSQLFullTextRankFilter[],
    threshold: number = 0.5
  ): Promise<[Document, number][]> {
    const { query, parameters } = this.constructQuery(
      k,
      AzureCosmosDBNoSQLSearchType.HybridScoreThreshold,
      {
        embeddings,
        fullTextRankFilter,
        offsetLimit: filter?.offsetLimit,
        projectionMapping: filter?.projectionMapping,
        withEmbedding: filter?.includeEmbeddings,
        filterClause: filter?.filterClause,
        weights: filter?.weights,
      }
    );

    return this.executeQuery(
      query,
      AzureCosmosDBNoSQLSearchType.HybridScoreThreshold,
      parameters,
      {
        withEmbedding: filter?.includeEmbeddings,
        projectionMapping: filter?.projectionMapping,
        threshold,
      }
    );
  }

  /**
   * Performs vector similarity search with score threshold filtering.
   */
  private async vectorSearchWithScoreThreshold(
    embeddings: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    threshold: number = 0.5
  ): Promise<[Document, number][]> {
    const { query, parameters } = this.constructQuery(
      k,
      AzureCosmosDBNoSQLSearchType.VectorScoreThreshold,
      {
        embeddings,
        filterClause: filter?.filterClause,
        offsetLimit: filter?.offsetLimit,
        projectionMapping: filter?.projectionMapping,
        withEmbedding: filter?.includeEmbeddings,
      }
    );

    return this.executeQuery(
      query,
      AzureCosmosDBNoSQLSearchType.VectorScoreThreshold,
      parameters,
      {
        withEmbedding: filter?.includeEmbeddings,
        projectionMapping: filter?.projectionMapping,
        threshold,
      }
    );
  }

  /**
   * Performs full-text search with BM25 ranking using RRF.
   * Note: Full-text ranking is a preview feature.
   */
  private async fullTextRanking(
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    fullTextRankFilter: AzureCosmosDBNoSQLFullTextRankFilter[]
  ): Promise<[Document, number][]> {
    const { query, parameters } = this.constructQuery(
      k,
      AzureCosmosDBNoSQLSearchType.FullTextRanking,
      {
        offsetLimit: filter?.offsetLimit,
        projectionMapping: filter?.projectionMapping,
        fullTextRankFilter,
        filterClause: filter?.filterClause,
      }
    );

    return this.executeQuery(
      query,
      AzureCosmosDBNoSQLSearchType.FullTextRanking,
      parameters,
      {
        withEmbedding: false,
        projectionMapping: filter?.projectionMapping,
      }
    );
  }

  /**
   * Performs basic full-text search without vector similarity.
   * Note: Full-text search is a preview feature.
   */
  private async fullTextSearch(
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    const { query, parameters } = this.constructQuery(
      k,
      AzureCosmosDBNoSQLSearchType.FullTextSearch,
      {
        offsetLimit: filter?.offsetLimit,
        projectionMapping: filter?.projectionMapping,
        filterClause: filter?.filterClause,
      }
    );

    return this.executeQuery(
      query,
      AzureCosmosDBNoSQLSearchType.FullTextSearch,
      parameters,
      {
        withEmbedding: false,
        projectionMapping: filter?.projectionMapping,
      }
    );
  }

  /**
   * Constructs a Cosmos DB SQL query string and parameters based on the search type and options.
   * Builds the complete SQL query including SELECT clause, projections, FROM clause,
   * WHERE conditions, ORDER BY clauses (with RRF for hybrid/full-text), and pagination.
   *
   * @param k The maximum number of results to return.
   * @param searchType The type of search to perform.
   * @param options Configuration options including embeddings, filters, projections, and search-specific parameters.
   * @returns An object containing the constructed SQL query string and an array of parameters.
   */
  private constructQuery(
    k: number,
    searchType: AzureCosmosDBNoSQLSearchType,
    options: {
      embeddings?: number[];
      fullTextRankFilter?: AzureCosmosDBNoSQLFullTextRankFilter[];
      offsetLimit?: string;
      projectionMapping?: ProjectionMapping;
      withEmbedding?: boolean;
      filterClause?: AzureCosmosDBNoSQLQueryFilter;
      weights?: number[];
    }
  ): { query: string; parameters: SqlParameter[] } {
    const table = this.tableAlias;

    let query = `SELECT ${!options.offsetLimit ? "TOP @limit " : ""}`;

    // Add projection fields
    query += this.generateProjectionFields(
      searchType,
      options.projectionMapping,
      options.fullTextRankFilter,
      options.withEmbedding
    );

    // Add FROM clause
    query += ` FROM ${table}`;

    // Add filterClause (WHERE clause) if provided
    if (options.filterClause) {
      if (typeof options.filterClause === "string") {
        query += ` ${options.filterClause}`;
      } else {
        query += ` ${options.filterClause.query}`;
      }
    }

    // Add ORDER BY clause based on search type
    if (searchType === AzureCosmosDBNoSQLSearchType.FullTextRanking) {
      if (options?.fullTextRankFilter?.length === 1) {
        const item = options.fullTextRankFilter[0];
        const terms = item.searchText
          .split(" ")
          .map((_, termIndex) => `@${item.searchField}_0_term_${termIndex}`)
          .join(", ");
        query += ` ORDER BY RANK FullTextScore(${table}[@${item.searchField}], ${terms})`;
      } else {
        const rankComponents = options?.fullTextRankFilter?.map(
          (item, filterIndex) => {
            const terms = item.searchText
              .split(" ")
              .map(
                (_, termIndex) =>
                  `@${item.searchField}_${filterIndex}_term_${termIndex}`
              )
              .join(", ");
            return `FullTextScore(${table}[@${item.searchField}], ${terms})`;
          }
        );
        query += ` ORDER BY RANK RRF(${rankComponents?.join(", ")})`;
      }
    } else if (
      searchType === AzureCosmosDBNoSQLSearchType.Vector ||
      searchType === AzureCosmosDBNoSQLSearchType.VectorScoreThreshold
    ) {
      query += ` ORDER BY VectorDistance(${table}[@embeddingKey], @embeddings)`;
    } else if (
      searchType === AzureCosmosDBNoSQLSearchType.Hybrid ||
      searchType === AzureCosmosDBNoSQLSearchType.HybridScoreThreshold
    ) {
      const rankComponents = options?.fullTextRankFilter?.map(
        (item, filterIndex) => {
          const terms = item.searchText
            .split(" ")
            .map(
              (_, termIndex) =>
                `@${item.searchField}_${filterIndex}_term_${termIndex}`
            )
            .join(", ");
          return `FullTextScore(${table}[@${item.searchField}], ${terms})`;
        }
      );

      query += ` ORDER BY RANK RRF(${rankComponents?.join(
        ", "
      )}, VectorDistance(${table}[@embeddingKey], @embeddings)`;
      if (options.weights) {
        query += ", @weights)";
      } else {
        query += ")";
      }
    }

    // Add offset/limit if provided
    if (options.offsetLimit) {
      query += ` ${options.offsetLimit}`;
    }

    const parameters = this.buildParameters(
      k,
      searchType,
      options.embeddings,
      options.projectionMapping,
      options.fullTextRankFilter,
      options.weights,
      options.filterClause
    );

    return { query, parameters };
  }

  /**
   * Generates the SELECT clause projection fields for the SQL query.
   */
  private generateProjectionFields(
    searchType: AzureCosmosDBNoSQLSearchType,
    projectionMapping?: ProjectionMapping,
    fullTextRankFilter?: AzureCosmosDBNoSQLFullTextRankFilter[],
    withEmbedding?: boolean
  ): string {
    const table = this.tableAlias;
    let projection = "";
    let isDefaultProjectionRequired = true;

    if (projectionMapping) {
      const fields = Object.entries(projectionMapping).map(
        ([key, alias]) => `${table}[@${key}] as ${alias}`
      );

      if (fields.length > 0) {
        projection += fields.join(", ");
        isDefaultProjectionRequired = false;
      }
    }

    if (fullTextRankFilter) {
      if (isDefaultProjectionRequired) {
        projection = `${table}.id, ${table}[@metadataKey] as ${this.metadataKey}`;
      }
      const fields: string[] = [];
      const addedSearchFields = new Set<string>();
      fullTextRankFilter.forEach((item) => {
        if (
          !projectionMapping ||
          !Object.keys(projectionMapping).includes(item.searchField)
        ) {
          if (!addedSearchFields.has(item.searchField)) {
            fields.push(
              `${table}[@${item.searchField}] as ${item.searchField}`
            );
            addedSearchFields.add(item.searchField);
          }
        }
      });
      if (fields.length > 0) {
        projection += `, ${fields.join(", ")}`;
      }
    } else {
      if (isDefaultProjectionRequired) {
        projection = `${table}.id, ${table}[@textKey] as ${this.textKey}, ${table}[@metadataKey] as ${this.metadataKey}`;
      }
    }

    if (
      searchType === AzureCosmosDBNoSQLSearchType.Vector ||
      searchType === AzureCosmosDBNoSQLSearchType.VectorScoreThreshold ||
      searchType === AzureCosmosDBNoSQLSearchType.Hybrid ||
      searchType === AzureCosmosDBNoSQLSearchType.HybridScoreThreshold
    ) {
      if (withEmbedding) {
        projection += `, ${table}[@embeddingKey] as ${this.embeddingKey}`;
      }
      projection += `, VectorDistance(${table}[@embeddingKey], @embeddings) as SimilarityScore`;
    }

    return projection;
  }

  /**
   * Builds the parameter array for the SQL query.
   */
  private buildParameters(
    k: number,
    searchType: AzureCosmosDBNoSQLSearchType,
    embeddings?: number[],
    projectionMapping?: ProjectionMapping,
    fullTextRankFilter?: AzureCosmosDBNoSQLFullTextRankFilter[],
    weights?: number[],
    filterClause?: AzureCosmosDBNoSQLQueryFilter
  ): SqlParameter[] {
    const parameters: SqlParameter[] = [{ name: "@limit", value: k }];
    let isDefaultParamRequired = true;

    // Add filterClause parameters if it's a SqlQuerySpec
    if (filterClause && typeof filterClause !== "string") {
      if (filterClause.parameters) {
        parameters.push(...filterClause.parameters);
      }
    }

    const addedFieldParams = new Set<string>();

    if (projectionMapping) {
      isDefaultParamRequired = false;
      Object.keys(projectionMapping).forEach((key) => {
        if (!addedFieldParams.has(key)) {
          parameters.push({ name: `@${key}`, value: key });
          addedFieldParams.add(key);
        }
      });
    }

    if (
      searchType === AzureCosmosDBNoSQLSearchType.Vector ||
      searchType === AzureCosmosDBNoSQLSearchType.VectorScoreThreshold ||
      searchType === AzureCosmosDBNoSQLSearchType.Hybrid ||
      searchType === AzureCosmosDBNoSQLSearchType.HybridScoreThreshold
    ) {
      parameters.push({
        name: "@embeddingKey",
        value: this.embeddingKey,
      });
      if (embeddings) {
        parameters.push({ name: "@embeddings", value: embeddings });
      }
      if (weights) {
        parameters.push({ name: "@weights", value: weights });
      }
    }

    if (fullTextRankFilter) {
      if (isDefaultParamRequired) {
        parameters.push({ name: "@metadataKey", value: this.metadataKey });
      }
      isDefaultParamRequired = false;
      fullTextRankFilter.forEach((item, filterIndex) => {
        if (!addedFieldParams.has(item.searchField)) {
          parameters.push({
            name: `@${item.searchField}`,
            value: item.searchField,
          });
          addedFieldParams.add(item.searchField);
        }
        item.searchText.split(" ").forEach((term, termIndex) => {
          parameters.push({
            name: `@${item.searchField}_${filterIndex}_term_${termIndex}`,
            value: term,
          });
        });
      });
    }

    if (isDefaultParamRequired) {
      parameters.push({
        name: "@textKey",
        value: this.textKey,
      });
      parameters.push({ name: "@metadataKey", value: this.metadataKey });
    }

    return parameters;
  }

  /**
   * Extracts the text content from a query result item.
   * Uses custom projection mapping alias if provided, otherwise falls back to the default textKey.
   */
  private extractTextFromItem(
    item: Record<string, unknown>,
    projectionMapping?: ProjectionMapping
  ): string {
    if (projectionMapping && this.textKey in projectionMapping) {
      const textKey = projectionMapping[this.textKey];
      return item[textKey] as string;
    }
    return item[this.textKey] as string;
  }

  /**
   * Populates metadata object from query result item fields.
   * Adds projected field aliases to metadata, or defaults to adding the document id.
   */
  private populateMetadataFromItem(
    item: Record<string, unknown>,
    baseMetadata: Record<string, unknown>,
    projectionMapping?: ProjectionMapping
  ): Record<string, unknown> {
    if (projectionMapping) {
      for (const [key, alias] of Object.entries(projectionMapping)) {
        if (key !== this.textKey) {
          baseMetadata[alias] = item[alias];
        }
      }
    } else {
      baseMetadata.id = item.id;
    }
    return baseMetadata;
  }

  /**
   * Executes a Cosmos DB SQL query and transforms the results into Documents with scores.
   * Runs the query against the container, processes the returned items,
   * applies threshold filtering if specified, and constructs Document objects with metadata.
   *
   * @param query The SQL query string to execute.
   * @param searchType The type of search being performed, which affects result processing.
   * @param parameters The query parameters to bind to the SQL query.
   * @param options Execution options including threshold filtering, embedding inclusion, and projection mapping.
   * @returns A promise that resolves to an array of tuples containing Documents and their scores.
   */
  private async executeQuery(
    query: string,
    searchType: AzureCosmosDBNoSQLSearchType,
    parameters: SqlParameter[],
    options: {
      withEmbedding?: boolean;
      projectionMapping?: ProjectionMapping;
      threshold?: number;
    }
  ): Promise<[Document, number][]> {
    await this.initialize();

    const { resources: items } = await this.container.items
      .query({ query, parameters }, { forceQueryPlan: true })
      .fetchAll();

    const threshold = options.threshold ?? 0;
    const isVectorSearch =
      searchType === AzureCosmosDBNoSQLSearchType.Vector ||
      searchType === AzureCosmosDBNoSQLSearchType.Hybrid ||
      searchType === AzureCosmosDBNoSQLSearchType.VectorScoreThreshold ||
      searchType === AzureCosmosDBNoSQLSearchType.HybridScoreThreshold;

    const isThresholdSearch =
      searchType === AzureCosmosDBNoSQLSearchType.VectorScoreThreshold ||
      searchType === AzureCosmosDBNoSQLSearchType.HybridScoreThreshold;

    const docsAndScores: [Document, number][] = [];

    for (const item of items) {
      const score = isVectorSearch ? item.SimilarityScore : 0;

      // Skip items below threshold for threshold-based searches
      if (isThresholdSearch && score <= threshold) {
        continue;
      }

      const metadata: Record<string, unknown> = {
        ...(item[this.metadataKey] || {}),
      };

      // Include embeddings if requested
      if (isVectorSearch && options.withEmbedding) {
        metadata[this.embeddingKey] = item[this.embeddingKey];
      }

      const text = this.extractTextFromItem(item, options.projectionMapping);
      this.populateMetadataFromItem(item, metadata, options.projectionMapping);

      docsAndScores.push([
        new Document({
          id: item.id,
          pageContent: text,
          metadata,
        }),
        score,
      ]);
    }

    return docsAndScores;
  }

  /**
   * Static method to create an instance of AzureCosmosDBNoSQLVectorStore from a
   * list of texts. It first converts the texts to vectors and then adds
   * them to the collection.
   * @param texts List of texts to be converted to vectors.
   * @param metadatas Metadata for the texts.
   * @param embeddings Embeddings to be used for conversion.
   * @param dbConfig Database configuration for Azure Cosmos DB for NoSQL.
   * @returns Promise that resolves to a new instance of AzureCosmosDBNoSQLVectorStore.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: AzureCosmosDBNoSQLConfig
  ): Promise<AzureCosmosDBNoSQLVectorStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return AzureCosmosDBNoSQLVectorStore.fromDocuments(
      docs,
      embeddings,
      dbConfig
    );
  }

  /**
   * Static method to create an instance of AzureCosmosDBNoSQLVectorStore from a
   * list of documents. It first converts the documents to vectors and then
   * adds them to the collection.
   * @param docs List of documents to be converted to vectors.
   * @param embeddings Embeddings to be used for conversion.
   * @param dbConfig Database configuration for Azure Cosmos DB for NoSQL.
   * @returns Promise that resolves to a new instance of AzureCosmosDBNoSQLVectorStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: AzureCosmosDBNoSQLConfig
  ): Promise<AzureCosmosDBNoSQLVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
}
