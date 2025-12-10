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
  IndexingPolicy,
  SqlParameter,
  SqlQuerySpec,
  VectorEmbedding,
  VectorEmbeddingPolicy,
  VectorIndex,
} from "@azure/cosmos";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";

/**
 * Azure Cosmos DB for NoSQL search type.
 */
export const AzureCosmosDBNoSQLSearchType = {
  /** Vector similarity search. */
  Vector: "vector",
  /** Vector search with score threshold filtering. */
  VectorScoreThreshold: "vectorScoreThreshold",
  /** Hybrid search combining vector and full-text search with RRF. */
  Hybrid: "hybrid",
  /** Hybrid search with score threshold filtering. */
  HybridScoreThreshold: "hybridScoreThreshold",
  /** Full-text search only. */
  FullTextSearch: "fullTextSearch",
  /** Full-text search with ranking. */
  FullTextRanking: "fullTextRanking",
} as const;

/**
 * Azure Cosmos DB for NoSQL search type.
 */
export type AzureCosmosDBNoSQLSearchType =
  (typeof AzureCosmosDBNoSQLSearchType)[keyof typeof AzureCosmosDBNoSQLSearchType];

/**
 * Full-text policy for the container.
 */
export type FullTextPolicy = {
  defaultLanguage: string;
  fullTextPaths: Array<{
    path: string;
    language?: string;
  }>;
};

/**
 * Full-text rank filter for hybrid search.
 */
export type FullTextRankFilter = Array<{
  searchField: string;
  searchText: string;
}>;

/**
 * Projection mapping for custom field selection.
 */
export type ProjectionMapping = Record<string, string>;

/** Azure Cosmos DB for NoSQL query filter. */
export type AzureCosmosDBNoSQLQueryFilter = string | SqlQuerySpec;

/** Azure Cosmos DB for NoSQL filter type. */
export type AzureCosmosDBNoSQLFilterType = {
  /**
   * SQL filter clause to add to the vector search query.
   */
  filterClause?: AzureCosmosDBNoSQLQueryFilter;
  /** Determines whether or not to include the embeddings in the search results. */
  includeEmbeddings?: boolean;
  /** Search type to use. */
  searchType?: AzureCosmosDBNoSQLSearchType;
  /** Full-text rank filter for hybrid search. */
  fullTextRankFilter?: FullTextRankFilter;
  /** Projection mapping for custom field selection. */
  projectionMapping?: ProjectionMapping;
  /** Offset and limit clause for pagination. */
  offsetLimit?: string;
  /** WHERE clause for additional filtering. */
  where?: string;
  /** Weights for hybrid search RRF ranking. */
  weights?: number[];
  /** Minimum relevance threshold for score filtering. */
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
 * Note that if you provides multiple vector embeddings in the vectorEmbeddingPolicy,
 * the first one will be used for creating documents and searching.
 */
export interface AzureCosmosDBNoSQLInitOptions {
  readonly vectorEmbeddingPolicy?: VectorEmbeddingPolicy;
  readonly fullTextPolicy?: FullTextPolicy;
  readonly indexingPolicy?: IndexingPolicy;
  readonly createContainerOptions?: AzureCosmosDBNoSqlCreateContainerOptions;
  readonly createDatabaseOptions?: AzureCosmosDBNoSqlCreateDatabaseOptions;
}

/**
 * Configuration options for the `AzureCosmosDBNoSQLVectorStore` constructor.
 */
export interface AzureCosmosDBNoSQLConfig
  extends AzureCosmosDBNoSQLInitOptions {
  readonly client?: CosmosClient;
  readonly connectionString?: string;
  readonly endpoint?: string;
  readonly credentials?: TokenCredential;
  readonly databaseName?: string;
  readonly containerName?: string;
  readonly textKey?: string;
  readonly metadataKey?: string;
  readonly fullTextSearchEnabled?: boolean;
  readonly tableAlias?: string;
}

const USER_AGENT_SUFFIX = "langchainjs-cdbnosql-vectorstore-javascript";

/**
 * Azure Cosmos DB for NoSQL vCore vector store.
 * To use this, you should have both:
 * - the `@azure/cosmos` NPM package installed
 * - a connection string associated with a NoSQL instance
 *
 * You do not need to create a database or container, it will be created
 * automatically.
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

  private readonly searchType: AzureCosmosDBNoSQLSearchType;

  private readonly fullTextSearchEnabled: boolean;

  private readonly tableAlias: string;

  private readonly fullTextPolicy?: FullTextPolicy;

  /**
   * Initializes the AzureCosmosDBNoSQLVectorStore.
   * Connect the client to the database and create the container, creating them if needed.
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
        let [endpoint, key] = connectionString!.split(";");
        [, endpoint] = endpoint.split("=");
        [, key] = key.split("=");

        this.client = new CosmosClient({
          endpoint,
          key,
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
          fullTextPolicy: this.fullTextPolicy,
          indexingPolicy,
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

    await Promise.all(ids.map((id) => this.container.item(id).delete()));
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
   * Performs a similarity search using query type specified in configuration.
   * If the query type is not specified, it defaults to vector similarity search.
   * @param query Query text for the similarity search.
   * @param k=4 Number of nearest neighbors to return.
   * @param filter Optional filter options for the documents.
   * @returns Promise that resolves to a list of documents.
   */
  async similaritySearch(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<Document[]> {
    const results = await this.similaritySearchWithScore(query, k, filter);

    return results.map((result) => result[0]);
  }

  /**
   * Performs a similarity search on the vectors stored in the container.
   * @param queryVector Query vector for the similarity search.
   * @param k=4 Number of nearest neighbors to return.
   * @param filter Optional filter options for the documents.
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
   */
  async similaritySearchVectorWithScore(
    queryVector: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    await this.initialize();

    let filterClause = "";
    let filterClauseParams: SqlParameter[] = [];
    if (filter?.filterClause) {
      if (typeof filter.filterClause === "string") {
        filterClause = `${filter.filterClause} `;
      } else {
        filterClause = `${filter.filterClause.query} `;
        filterClauseParams = filter.filterClause.parameters ?? [];
      }
    }

    const embeddings = filter?.includeEmbeddings
      ? `${this.tableAlias}[@embeddingKey] AS vector, `
      : "";
    const query = `SELECT TOP @k ${this.tableAlias}.id, ${embeddings}${this.tableAlias}[@textKey] AS text, ${this.tableAlias}[@metadataKey] AS metadata, VectorDistance(${this.tableAlias}[@embeddingKey], @vector) AS similarityScore FROM ${this.tableAlias} ${filterClause}ORDER BY VectorDistance(${this.tableAlias}[@embeddingKey], @vector)`;

    const { resources: items } = await this.container.items
      .query(
        {
          query,
          parameters: [
            ...filterClauseParams,
            { name: "@k", value: k },
            { name: "@textKey", value: this.textKey },
            { name: "@metadataKey", value: this.metadataKey },
            { name: "@embeddingKey", value: this.embeddingKey },
            { name: "@vector", value: queryVector },
          ],
        },
        { maxItemCount: k }
      )
      .fetchAll();

    const docsAndScores = items.map(
      (item) =>
        [
          new Document({
            id: item.id,
            pageContent: item.text,
            metadata: {
              ...(item.metadata ?? {}),
              ...(filter?.includeEmbeddings
                ? { [this.embeddingKey]: item.vector }
                : {}),
            },
          }),
          item.similarityScore,
        ] as [Document, number]
    );

    return docsAndScores;
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND
   * diversity among selected documents.
   * @param query Text to look up documents similar to.
   * @param options.k Number of documents to return.
   * @param options.fetchK=20 Number of documents to fetch before passing to
   *     the MMR algorithm.
   * @param options.lambda=0.5 Number between 0 and 1 that determines the
   *     degree of diversity among the results, where 0 corresponds to maximum
   *     diversity and 1 to minimum diversity.
   * @returns List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    const { k, fetchK = 20, lambda = 0.5 } = options;
    const includeEmbeddingsFlag = options.filter?.includeEmbeddings || false;

    const queryEmbedding = await this.embeddings.embedQuery(query);
    const docs = await this.similaritySearchVectorWithScore(
      queryEmbedding,
      fetchK,
      {
        ...options.filter,
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
   * @param containerName The name of the collection to use.
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

    const { container } = await database.containers.createIfNotExists({
      ...(initOptions?.createContainerOptions ?? {}),
      indexingPolicy: initOptions?.indexingPolicy,
      vectorEmbeddingPolicy,
      fullTextPolicy: initOptions?.fullTextPolicy as any,
      id: containerName,
    });
    this.container = container;
  }

  /**
   * Performs a similarity search and returns documents with their similarity scores.
   * This method routes to the appropriate search implementation based on the search type
   * specified in the filter or the default search type configured for the vector store.
   * Supports vector, hybrid, full-text, and threshold-based search types.
   * 
   * @param query - The text query to search for similar documents.
   * @param k - The number of nearest neighbor documents to return. Defaults to 4.
   * @param filter - Optional filter configuration including search type, threshold, full-text filters, and other options.
   * @returns A promise that resolves to an array of tuples, where each tuple contains a Document and its similarity score.
   */
  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    const searchType = filter?.searchType ?? this.searchType;

    if (searchType === AzureCosmosDBNoSQLSearchType.Vector) {
      return this.similaritySearchVectorWithScore(queryEmbedding, k, filter);
    }
    else if (searchType === AzureCosmosDBNoSQLSearchType.VectorScoreThreshold) {
      return this.vectorSearchWithScoreThreshold(
        queryEmbedding,
        k,
        filter,
        filter?.threshold
      );
    }
    else if (searchType === AzureCosmosDBNoSQLSearchType.Hybrid) {
      if (!filter?.fullTextRankFilter) {
        throw new Error(
          `fullTextRankFilter is required for ${searchType} search type`
        );
      }
      return this.hybridSearchWithScore(
        queryEmbedding,
        k,
        filter,
        filter.fullTextRankFilter,
      );
    }
    else if (searchType === AzureCosmosDBNoSQLSearchType.HybridScoreThreshold) {
      if (!filter?.fullTextRankFilter) {
        throw new Error(
          `fullTextRankFilter is required for ${searchType} search type`
        );
      }
      return this.hybridSearchWithScoreThreshold(
        queryEmbedding,
        k,
        filter,
        filter.fullTextRankFilter,
        filter?.threshold,
      );
    }
    else if (searchType === AzureCosmosDBNoSQLSearchType.FullTextSearch) {
      return this.fullTextSearch(
        k,
        filter
      );
    }
    else if (searchType === AzureCosmosDBNoSQLSearchType.FullTextRanking) {
      if (!filter?.fullTextRankFilter) {
        throw new Error(
          `fullTextRankFilter is required for ${searchType} search type`
        );
      }
      return this.fullTextRanking(
        k,
        filter,
        filter.fullTextRankFilter
      );
    }
    throw new Error(`Unrecognized search type '${searchType}'`);
  }

  /**
   * Performs a hybrid search combining vector similarity and full-text search using Reciprocal Rank Fusion (RRF).
   * This internal method merges vector-based semantic search with keyword-based full-text search to provide
   * more relevant results by leveraging both search paradigms.
   * 
   * @param embeddings - The query embedding vector for similarity comparison.
   * @param k - The number of documents to return. Defaults to 4.
   * @param filter - Optional filter configuration for WHERE clauses, pagination, projection mapping, and embeddings.
   * @param fullTextRankFilter - Configuration for full-text search fields and search terms.
   * @returns A promise that resolves to an array of tuples containing Documents and their similarity scores.
   */
  private async hybridSearchWithScore(
    embeddings: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    fullTextRankFilter: FullTextRankFilter,
  ): Promise<[Document, number][]> {

    const { query, parameters } = this.constructQuery(k, AzureCosmosDBNoSQLSearchType.Hybrid, {
      embeddings,
      fullTextRankFilter,
      offsetLimit: filter?.offsetLimit,
      projectionMapping: filter?.projectionMapping,
      withEmbedding: filter?.includeEmbeddings,
      where: filter?.where,
      weights: filter?.weights,
    });

    return this.executeQuery(query, AzureCosmosDBNoSQLSearchType.Hybrid, parameters, {
      withEmbedding: filter?.includeEmbeddings,
      projectionMapping: filter?.projectionMapping,
    });
  }

  /**
   * Performs a hybrid search with score threshold filtering.
   * Similar to hybridSearchWithScore but filters out results below the specified similarity threshold.
   * This is useful for ensuring only highly relevant results are returned from the combined
   * vector and full-text search.
   * 
   * @param embeddings - The query embedding vector for similarity comparison.
   * @param k - The number of documents to return. Defaults to 4.
   * @param filter - Optional filter configuration for WHERE clauses, pagination, projection mapping, and embeddings.
   * @param fullTextRankFilter - Configuration for full-text search fields and search terms.
   * @param threshold - The minimum similarity score threshold. Documents with scores below this value are excluded. Defaults to 0.5.
   * @returns A promise that resolves to an array of tuples containing Documents and their similarity scores.
   */
  private async hybridSearchWithScoreThreshold(
    embeddings: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    fullTextRankFilter: FullTextRankFilter,
    threshold: number = 0.5
  ): Promise<[Document, number][]> {

    const { query, parameters } = this.constructQuery(k, AzureCosmosDBNoSQLSearchType.HybridScoreThreshold, {
      embeddings,
      fullTextRankFilter,
      offsetLimit: filter?.offsetLimit,
      projectionMapping: filter?.projectionMapping,
      withEmbedding: filter?.includeEmbeddings,
      where: filter?.where,
      weights: filter?.weights,
    });

    return this.executeQuery(query, AzureCosmosDBNoSQLSearchType.HybridScoreThreshold, parameters, {
      withEmbedding: filter?.includeEmbeddings,
      projectionMapping: filter?.projectionMapping,
      threshold: threshold,
    });
  }

  /**
   * Performs a vector similarity search with score threshold filtering.
   * Only returns documents whose similarity scores meet or exceed the specified threshold value.
   * This helps filter out less relevant results and focus on high-quality matches.
   * 
   * @param embeddings - The query embedding vector for similarity comparison.
   * @param k - The number of documents to return. Defaults to 4.
   * @param filter - Optional filter configuration for WHERE clauses, pagination, projection mapping, and embeddings.
   * @param threshold - The minimum similarity score threshold. Documents with scores below this value are excluded. Defaults to 0.5.
   * @returns A promise that resolves to an array of tuples containing Documents and their similarity scores.
   */
  private async vectorSearchWithScoreThreshold(
    embeddings: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    threshold: number= 0.5,
  ): Promise<[Document, number][]> {
    const { query, parameters } = this.constructQuery(
      k,
      AzureCosmosDBNoSQLSearchType.VectorScoreThreshold,
      {
        embeddings: embeddings,
        where: filter?.where,
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
   * Performs a full-text search with ranking based on text relevance scores.
   * Uses Cosmos DB's full-text indexing and scoring capabilities to rank documents
   * by their relevance to the search terms. Supports multiple search fields with
   * Reciprocal Rank Fusion (RRF) for combining scores across fields.
   * 
   * @param k - The number of documents to return. Defaults to 4.
   * @param filter - Optional filter configuration for WHERE clauses, pagination, and projection mapping.
   * @param fullTextRankFilter - Configuration specifying which fields to search and the search terms.
   * @returns A promise that resolves to an array of tuples containing Documents and their relevance scores.
   */
  private async fullTextRanking(
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
    fullTextRankFilter: FullTextRankFilter,
  ): Promise<[Document, number][]> {
    const { query, parameters } = this.constructQuery(
      k,
      AzureCosmosDBNoSQLSearchType.FullTextRanking,
      {
        offsetLimit: filter?.offsetLimit,
        projectionMapping: filter?.projectionMapping,
        fullTextRankFilter: fullTextRankFilter,
        where: filter?.where,
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
   * Performs a basic full-text search across indexed text fields.
   * This method uses Cosmos DB's full-text search capabilities to find documents
   * matching the search criteria without vector similarity comparison.
   * 
   * @param k - The number of documents to return. Defaults to 4.
   * @param filter - Optional filter configuration for WHERE clauses, pagination, and projection mapping.
   * @returns A promise that resolves to an array of tuples containing Documents and their scores (0 for full-text only).
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
        where: filter?.where,
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
   * This method builds the complete SQL query including SELECT clause, projections, FROM clause,
   * WHERE conditions, ORDER BY clauses (with RRF for hybrid/full-text), and pagination.
   * 
   * @param k - The maximum number of results to return.
   * @param searchType - The type of search to perform (vector, hybrid, full-text, etc.).
   * @param options - Configuration options including embeddings, filters, projections, and search-specific parameters.
   * @returns An object containing the constructed SQL query string and an array of parameters.
   */
  private constructQuery(
    k: number,
    searchType: AzureCosmosDBNoSQLSearchType,
    options: {
      embeddings?: number[];
      fullTextRankFilter?: FullTextRankFilter;
      offsetLimit?: string;
      projectionMapping?: ProjectionMapping;
      withEmbedding?: boolean;
      where?: string;
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

  // Add WHERE clause if provided
  if (options.where) {
    query += ` WHERE ${options.where}`;
  }

    // Add ORDER BY clause based on search type
    if (
      // searchType === AzureCosmosDBNoSQLSearchType.FullTextSearch ||
      searchType === AzureCosmosDBNoSQLSearchType.FullTextRanking
    ) {

      if (options?.fullTextRankFilter?.length === 1) {
        const item = options.fullTextRankFilter[0];
        const terms = item.searchText
          .split(" ")
          .map((_, i) => `@${item.searchField}_term_${i}`)
          .join(", ");
        query += ` ORDER BY RANK FullTextScore(${table}[@${item.searchField}], ${terms})`;
      } else {
        const rankComponents = options?.fullTextRankFilter?.map((item) => {
          const terms = item.searchText
            .split(" ")
            .map((_, i) => `@${item.searchField}_term_${i}`)
            .join(", ");
          return `FullTextScore(${table}[@${item.searchField}], ${terms})`;
        });
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

      const rankComponents = options?.fullTextRankFilter?.map((item) => {
        const terms = item.searchText
          .split(" ")
          .map((_, i) => `@${item.searchField}_term_${i}`)
          .join(", ");
        return `FullTextScore(${table}[@${item.searchField}], ${terms})`;
      });

      query += ` ORDER BY RANK RRF(${rankComponents?.join(", ")}, VectorDistance(${table}[@embeddingKey], @embeddings)`;
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
      options.weights
    );

    return { query, parameters };
  }

  /**
   * Generates the SELECT clause projection fields for the SQL query.
   * Determines which fields to return based on search type, custom projection mappings,
   * full-text filters, and whether embeddings should be included in results.
   * 
   * @param searchType - The type of search being performed, which affects what fields are projected.
   * @param projectionMapping - Optional custom mapping of field names to aliases.
   * @param fullTextRankFilter - Optional full-text search configuration that determines text fields to project.
   * @param withEmbedding - Whether to include embedding vectors in the projection.
   * @returns A comma-separated string of field projections for the SELECT clause.
   */
  private generateProjectionFields(
    searchType: AzureCosmosDBNoSQLSearchType,
    projectionMapping?: ProjectionMapping,
    fullTextRankFilter?: FullTextRankFilter,
    withEmbedding?: boolean
  ): string {
    const table = this.tableAlias;

    if (projectionMapping) {
      return Object.entries(projectionMapping)
        .map(([key, alias]) => `${table}[@${key}] as ${alias}`)
        .join(", ");
    } else if (fullTextRankFilter) {
      const fields = [`${table}.id`];
      fullTextRankFilter.forEach((item) => {
        fields.push(`${table}[@${item.searchField}] as ${item.searchField}`);
      });
      let projection = fields.join(", ");

      if (
        searchType === AzureCosmosDBNoSQLSearchType.Vector ||
        searchType === AzureCosmosDBNoSQLSearchType.VectorScoreThreshold ||
        searchType === AzureCosmosDBNoSQLSearchType.Hybrid ||
        searchType === AzureCosmosDBNoSQLSearchType.HybridScoreThreshold
      ) {
        if (withEmbedding) {
          projection += `, ${table}[@embeddingKey] as embedding`;
        }
        projection += `, VectorDistance(${table}[@embeddingKey], @embeddings) as SimilarityScore`;
      }

      return projection;
    } else {
      let projection = `${table}.id, ${table}[@textKey] as ${this.textKey}, ${table}[@metadataKey] as metadata`;

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
  }

  /**
   * Builds the parameter array for the SQL query.
   * Creates parameter objects for all dynamic values used in the query, including
   * result limits, field names, embeddings, weights, and full-text search terms.
   * 
   * @param k - The maximum number of results (used for @limit parameter).
   * @param searchType - The type of search, which determines which parameters are needed.
   * @param embeddings - Optional embedding vector for vector-based searches.
   * @param projectionMapping - Optional field projection mapping.
   * @param fullTextRankFilter - Optional full-text search configuration with search terms.
   * @param weights - Optional RRF weights for hybrid search ranking.
   * @returns An array of SqlParameter objects to be used with the query.
   */
  private buildParameters(
    k: number,
    searchType: AzureCosmosDBNoSQLSearchType,
    embeddings?: number[],
    projectionMapping?: ProjectionMapping,
    fullTextRankFilter?: FullTextRankFilter,
    weights?: number[]
  ): SqlParameter[] {
    const parameters: SqlParameter[] = [{ name: "@limit", value: k }];

    if (projectionMapping) {
      Object.keys(projectionMapping).forEach((key) => {
        parameters.push({ name: `@${key}`, value: key });
      });
    } else {
      parameters.push({
        name: "@textKey",
        value: this.textKey,
      });
      parameters.push({ name: "@metadataKey", value: this.metadataKey });
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
      fullTextRankFilter.forEach((item) => {
        parameters.push({
          name: `@${item.searchField}`,
          value: item.searchField,
        });
        item.searchText.split(" ").forEach((term, i) => {
          parameters.push({
            name: `@${item.searchField}_term_${i}`,
            value: term,
          });
        });
      });
    }

    return parameters;
  }

  /**
   * Executes a Cosmos DB SQL query and transforms the results into Documents with scores.
   * This method runs the query against the container, processes the returned items,
   * applies threshold filtering if specified, and constructs Document objects with metadata.
   * 
   * @param query - The SQL query string to execute.
   * @param searchType - The type of search being performed, which affects result processing.
   * @param parameters - The query parameters to bind to the SQL query.
   * @param options - Execution options including threshold filtering, embedding inclusion, and projection mapping.
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
      .query({
        query,
        parameters,
      })
      .fetchAll();

    const docsAndScores: [Document, number][] = [];
    const threshold = options.threshold || 0;

    for (const item of items) {
      const metadata = { ...(item[this.metadataKey] || {}) };
      let score = 0;
      let text = "";

      if (
        searchType === AzureCosmosDBNoSQLSearchType.Vector ||
        searchType === AzureCosmosDBNoSQLSearchType.Hybrid ||
        searchType === AzureCosmosDBNoSQLSearchType.VectorScoreThreshold ||
        searchType === AzureCosmosDBNoSQLSearchType.HybridScoreThreshold
      ) {
        score = item.SimilarityScore;
        if (options.withEmbedding) {
          metadata[this.embeddingKey] = item[this.embeddingKey];
        }

        if (
          (searchType === AzureCosmosDBNoSQLSearchType.VectorScoreThreshold ||
            searchType === AzureCosmosDBNoSQLSearchType.HybridScoreThreshold) &&
          score <= threshold
        ) {
          continue;
        }

        if (
          options.projectionMapping &&
          this.textKey in options.projectionMapping
        ) {
          const textKey =
            options.projectionMapping[this.textKey];
          text = item[textKey];
        } else {
          text = item[this.textKey];
        }

        if (options.projectionMapping) {
          for (const [key, alias] of Object.entries(options.projectionMapping)) {
            if (key === this.textKey) {
              continue;
            }
            metadata[alias] = item[alias];
          }
        } else {
          metadata.id = item.id;
        }
      } else {
        // Full-text search
        if (
          options.projectionMapping &&
          this.textKey in options.projectionMapping
        ) {
          const textKey =
            options.projectionMapping[this.textKey];
          text = item[textKey];
        } else {
          text = item[this.textKey];
        }

        if (options.projectionMapping) {
          for (const [key, alias] of Object.entries(options.projectionMapping)) {
            if (key === this.textKey) {
              continue;
            }
            metadata[alias] = item[alias];
          }
        } else {
          metadata.id = item.id;
        }
      }

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
