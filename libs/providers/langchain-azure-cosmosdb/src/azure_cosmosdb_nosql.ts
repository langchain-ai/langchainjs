import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  MaxMarginalRelevanceSearchOptions,
  VectorStore,
  VectorStoreRetriever,
} from "@langchain/core/vectorstores";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
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
  /** Vector similarity search */
  Vector: "vector",
  /** Vector search with score threshold */
  VectorScoreThreshold: "vector_score_threshold",
  /** Full-text search (preview feature) */
  FullTextSearch: "full_text_search",
  /** Full-text search with BM25 ranking (preview feature) */
  FullTextRanking: "full_text_ranking",
  /** Hybrid search combining vector and full-text using RRF (preview feature) */
  Hybrid: "hybrid",
  /** Hybrid search with score threshold (preview feature) */
  HybridScoreThreshold: "hybrid_score_threshold",
} as const;

/** Azure Cosmos DB for NoSQL search type. */
export type AzureCosmosDBNoSQLSearchType =
  (typeof AzureCosmosDBNoSQLSearchType)[keyof typeof AzureCosmosDBNoSQLSearchType];

/** Full-text rank filter item for full-text ranking queries. */
export interface AzureCosmosDBNoSQLFullTextRankFilter {
  /** The field to search */
  searchField: string;
  /** The search text */
  searchText: string;
}

/** Azure Cosmos DB for NoSQL query filter. */
export type AzureCosmosDBNoSQLQueryFilter = string | SqlQuerySpec;

/** Azure Cosmos DB for NoSQL filter type. */
export type AzureCosmosDBNoSQLFilterType = {
  /**
   * SQL filter clause to add to the vector search query.
   * @example 'WHERE c.category = "cars" LIMIT 10 OFFSET 0'
   */
  filterClause?: AzureCosmosDBNoSQLQueryFilter;
  /** Determines whether or not to include the embeddings in the search results. */
  includeEmbeddings?: boolean;
  /**
   * Offset and limit clause for pagination.
   * @example 'OFFSET 10 LIMIT 20'
   */
  offsetLimit?: string;
  /**
   * Projection mapping for custom field selection.
   * Maps field names to their paths in the document.
   */
  projectionMapping?: Record<string, string>;
  /**
   * Full-text rank filter for full-text ranking queries.
   * Each item specifies a field to search and the search text.
   */
  fullTextRankFilter?: AzureCosmosDBNoSQLFullTextRankFilter[];
  /**
   * WHERE clause for additional filtering.
   * @example 'c.metadata.category = "tech"'
   */
  where?: string;
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
 * Note that if you provides multiple vector embeddings in the vectorEmbeddingPolicy,
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
  readonly client?: CosmosClient;
  readonly connectionString?: string;
  readonly endpoint?: string;
  readonly credentials?: TokenCredential;
  readonly databaseName?: string;
  readonly containerName?: string;
  readonly textKey?: string;
  readonly metadataKey?: string;
  /**
   * Enable full-text search capabilities (preview feature).
   * When enabled, fullTextPolicy and appropriate indexingPolicy must be configured.
   */
  readonly fullTextSearchEnabled?: boolean;
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

    // Deferring initialization to the first call to `initialize`
    this.initialize = () => {
      if (this.initPromise === undefined) {
        this.initPromise = this.init(client, databaseName, containerName, {
          vectorEmbeddingPolicy,
          indexingPolicy,
          fullTextPolicy: dbConfig.fullTextPolicy,
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
      ? `c[@embeddingKey] AS vector, `
      : "";
    const query = `SELECT TOP @k c.id, ${embeddings}c[@textKey] AS text, c[@metadataKey] AS metadata, VectorDistance(c[@embeddingKey], @vector) AS similarityScore FROM c ${filterClause}ORDER BY VectorDistance(c[@embeddingKey], @vector)`;

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
   * Return documents selected using the maximal marginal relevance from a vector.
   * Maximal marginal relevance optimizes for similarity to the query AND
   * diversity among selected documents.
   * @param queryEmbedding Query embedding vector.
   * @param options.k Number of documents to return.
   * @param options.fetchK=20 Number of documents to fetch before passing to
   *     the MMR algorithm.
   * @param options.lambda=0.5 Number between 0 and 1 that determines the
   *     degree of diversity among the results, where 0 corresponds to maximum
   *     diversity and 1 to minimum diversity.
   * @returns List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearchByVector(
    queryEmbedding: number[],
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    const { k, fetchK = 20, lambda = 0.5 } = options;
    const includeEmbeddingsFlag = options.filter?.includeEmbeddings || false;

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
   * Performs a vector similarity search with score threshold filtering.
   * Only results with a similarity score >= threshold are returned.
   * @param query Query text for the similarity search.
   * @param k Number of nearest neighbors to return.
   * @param threshold Minimum similarity score threshold (0-1).
   * @param filter Optional filter options for the documents.
   * @returns Promise that resolves to a list of documents and their similarity scores.
   */
  async vectorSearchWithThreshold(
    query: string,
    k = 4,
    threshold = 0.5,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    const results = await this.similaritySearchWithScore(query, k, filter);
    return results.filter(([, score]) => score >= threshold);
  }

  /**
   * Performs a full-text search on the documents.
   * Note: Full-text search is a preview feature and requires appropriate container configuration.
   * @param query Query text for the full-text search.
   * @param k Number of results to return.
   * @param filter Optional filter options for the documents.
   * @returns Promise that resolves to a list of documents and their scores.
   */
  async fullTextSearch(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    await this.initialize();

    const { queryText, parameters } = this._constructFullTextQuery(
      query,
      k,
      "full_text_search",
      filter
    );

    const { resources: items } = await this.container.items
      .query({ query: queryText, parameters }, { maxItemCount: k })
      .fetchAll();

    return this._processSearchResults(items, filter);
  }

  /**
   * Performs a full-text search with BM25 ranking.
   * Note: Full-text ranking is a preview feature and requires appropriate container configuration.
   * @param k Number of results to return.
   * @param filter Filter options including fullTextRankFilter for specifying search fields and texts.
   * @returns Promise that resolves to a list of documents and their BM25 scores.
   */
  async fullTextRanking(
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    await this.initialize();

    if (!filter?.fullTextRankFilter || filter.fullTextRankFilter.length === 0) {
      throw new Error(
        "fullTextRanking requires fullTextRankFilter to be specified in filter"
      );
    }

    const { queryText, parameters } = this._constructFullTextQuery(
      "",
      k,
      "full_text_ranking",
      filter
    );

    const { resources: items } = await this.container.items
      .query({ query: queryText, parameters }, { maxItemCount: k })
      .fetchAll();

    return this._processSearchResults(items, filter);
  }

  /**
   * Performs a hybrid search combining vector similarity and full-text search using RRF.
   * Note: Hybrid search is a preview feature and requires appropriate container configuration.
   * @param query Query text for both vector and full-text search.
   * @param k Number of results to return.
   * @param filter Optional filter options including weights for RRF.
   * @returns Promise that resolves to a list of documents and their combined scores.
   */
  async hybridSearchWithScore(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    await this.initialize();

    const queryEmbedding = await this.embeddings.embedQuery(query);
    const { queryText, parameters } = this._constructHybridQuery(
      queryEmbedding,
      query,
      k,
      "hybrid",
      filter
    );

    const { resources: items } = await this.container.items
      .query({ query: queryText, parameters }, { maxItemCount: k })
      .fetchAll();

    return this._processSearchResults(items, filter);
  }

  /**
   * Performs a hybrid search with score threshold filtering.
   * Only results with a combined score >= threshold are returned.
   * Note: Hybrid search is a preview feature and requires appropriate container configuration.
   * @param query Query text for both vector and full-text search.
   * @param k Number of results to return.
   * @param threshold Minimum score threshold.
   * @param filter Optional filter options including weights for RRF.
   * @returns Promise that resolves to a list of documents and their combined scores.
   */
  async hybridSearchWithThreshold(
    query: string,
    k = 4,
    threshold = 0.5,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    const results = await this.hybridSearchWithScore(query, k, filter);
    return results.filter(([, score]) => score >= threshold);
  }

  /**
   * Deletes a specific document by its ID.
   * @param documentId The ID of the document to delete.
   * @returns A promise that resolves when the document has been deleted.
   */
  async deleteDocumentById(documentId: string): Promise<void> {
    await this.initialize();
    await this.container.item(documentId, documentId).delete();
  }

  /**
   * Gets the underlying Cosmos DB container.
   * @returns The Cosmos DB container instance.
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Returns an AzureCosmosDBNoSQLVectorStoreRetriever initialized from this VectorStore.
   * Supports multiple search types including vector, full-text, hybrid, and MMR.
   * @param fields Retriever configuration options.
   * @returns AzureCosmosDBNoSQLVectorStoreRetriever initialized from this VectorStore.
   */
  asCosmosRetriever(
    fields?: Omit<AzureCosmosDBNoSQLVectorStoreRetrieverInput, "vectorStore">
  ): AzureCosmosDBNoSQLVectorStoreRetriever {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new AzureCosmosDBNoSQLVectorStoreRetriever({
      vectorStore: this,
      k: fields?.k ?? 4,
      searchType: fields?.searchType,
      searchKwargs: fields?.searchKwargs,
      ...fields,
    });
  }

  /**
   * Constructs a full-text search query.
   */
  private _constructFullTextQuery(
    query: string,
    k: number,
    searchType: AzureCosmosDBNoSQLSearchType,
    filter: this["FilterType"] | undefined
  ): { queryText: string; parameters: SqlParameter[] } {
    const parameters: SqlParameter[] = [
      { name: "@k", value: k },
      { name: "@textKey", value: this.textKey },
      { name: "@metadataKey", value: this.metadataKey },
    ];

    let projection = `c.id, c[@textKey] AS text, c[@metadataKey] AS metadata`;
    let orderBy = "";

    if (searchType === "full_text_ranking" && filter?.fullTextRankFilter) {
      // Build FullTextScore for ranking
      const scoreExpressions = filter.fullTextRankFilter.map((item, idx) => {
        parameters.push({
          name: `@searchField${idx}`,
          value: item.searchField,
        });
        parameters.push({ name: `@searchText${idx}`, value: item.searchText });
        return `FullTextScore(c[@searchField${idx}], [@searchText${idx}])`;
      });
      projection += `, ${scoreExpressions.join(" + ")} AS score`;
      orderBy = `ORDER BY ${scoreExpressions.map((_, idx) => `FullTextScore(c[@searchField${idx}], [@searchText${idx}])`).join(" + ")} DESC`;
    } else if (searchType === "full_text_search") {
      parameters.push({ name: "@query", value: query });
      projection += `, FullTextScore(c[@textKey], [@query]) AS score`;
      orderBy = `ORDER BY FullTextScore(c[@textKey], [@query]) DESC`;
    }

    if (filter?.includeEmbeddings) {
      parameters.push({ name: "@embeddingKey", value: this.embeddingKey });
      projection = `c[@embeddingKey] AS vector, ${projection}`;
    }

    let queryText = `SELECT ${filter?.offsetLimit ? "" : "TOP @k "}${projection} FROM c`;

    if (filter?.where) {
      queryText += ` WHERE ${filter.where}`;
    }

    if (orderBy) {
      queryText += ` ${orderBy}`;
    }

    if (filter?.offsetLimit) {
      queryText += ` ${filter.offsetLimit}`;
    }

    return { queryText, parameters };
  }

  /**
   * Constructs a hybrid search query combining vector and full-text search.
   */
  private _constructHybridQuery(
    queryEmbedding: number[],
    queryText: string,
    k: number,
    _searchType: AzureCosmosDBNoSQLSearchType,
    filter: this["FilterType"] | undefined
  ): { queryText: string; parameters: SqlParameter[] } {
    const parameters: SqlParameter[] = [
      { name: "@k", value: k },
      { name: "@textKey", value: this.textKey },
      { name: "@metadataKey", value: this.metadataKey },
      { name: "@embeddingKey", value: this.embeddingKey },
      { name: "@vector", value: queryEmbedding },
      { name: "@query", value: queryText },
    ];

    // Build the RRF (Reciprocal Rank Fusion) query
    let projection = `c.id, c[@textKey] AS text, c[@metadataKey] AS metadata`;

    if (filter?.includeEmbeddings) {
      projection = `c[@embeddingKey] AS vector, ${projection}`;
    }

    // Add weights if provided
    if (filter?.weights && filter.weights.length >= 2) {
      parameters.push({ name: "@vectorWeight", value: filter.weights[0] });
      parameters.push({ name: "@textWeight", value: filter.weights[1] });
      projection += `, RRF(VectorDistance(c[@embeddingKey], @vector), FullTextScore(c[@textKey], [@query]), @vectorWeight, @textWeight) AS score`;
    } else {
      projection += `, RRF(VectorDistance(c[@embeddingKey], @vector), FullTextScore(c[@textKey], [@query])) AS score`;
    }

    let query = `SELECT ${filter?.offsetLimit ? "" : "TOP @k "}${projection} FROM c`;

    if (filter?.where) {
      query += ` WHERE ${filter.where}`;
    }

    query += ` ORDER BY RANK RRF(VectorDistance(c[@embeddingKey], @vector), FullTextScore(c[@textKey], [@query]))`;

    if (filter?.offsetLimit) {
      query += ` ${filter.offsetLimit}`;
    }

    return { queryText: query, parameters };
  }

  /**
   * Processes search results into Document objects with scores.
   */
  private _processSearchResults(
    items: Array<Record<string, unknown>>,
    filter: this["FilterType"] | undefined
  ): [Document, number][] {
    return items.map(
      (item) =>
        [
          new Document({
            id: item.id as string,
            pageContent: item.text as string,
            metadata: {
              ...((item.metadata as Record<string, unknown>) ?? {}),
              ...(filter?.includeEmbeddings
                ? { [this.embeddingKey]: item.vector }
                : {}),
            },
          }),
          (item.score as number) ?? 0,
        ] as [Document, number]
    );
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

  /**
   * Static method to create an instance using Azure AD authentication.
   * @param endpoint The Cosmos DB endpoint URL.
   * @param credentials Azure credential for authentication (defaults to DefaultAzureCredential).
   * @param embeddings Embeddings to be used for conversion.
   * @param dbConfig Additional database configuration options.
   * @returns Promise that resolves to a new instance of AzureCosmosDBNoSQLVectorStore.
   */
  static async fromConnectionStringWithAAD(
    endpoint: string,
    credentials: TokenCredential | undefined,
    embeddings: EmbeddingsInterface,
    dbConfig: Omit<
      AzureCosmosDBNoSQLConfig,
      "connectionString" | "endpoint" | "credentials" | "client"
    > = {}
  ): Promise<AzureCosmosDBNoSQLVectorStore> {
    const client = new CosmosClient({
      endpoint,
      aadCredentials: credentials ?? new DefaultAzureCredential(),
      userAgentSuffix: USER_AGENT_SUFFIX,
    } as CosmosClientOptions);

    return new this(embeddings, {
      ...dbConfig,
      client,
    });
  }

  /**
   * Static method to create an instance using a connection string with account key.
   * @param connectionString The Cosmos DB connection string.
   * @param embeddings Embeddings to be used for conversion.
   * @param dbConfig Additional database configuration options.
   * @returns Promise that resolves to a new instance of AzureCosmosDBNoSQLVectorStore.
   */
  static async fromConnectionStringWithKey(
    connectionString: string,
    embeddings: EmbeddingsInterface,
    dbConfig: Omit<
      AzureCosmosDBNoSQLConfig,
      "connectionString" | "endpoint" | "credentials" | "client"
    > = {}
  ): Promise<AzureCosmosDBNoSQLVectorStore> {
    let [endpoint, key] = connectionString.split(";");
    [, endpoint] = endpoint.split("=");
    [, key] = key.split("=");

    const client = new CosmosClient({
      endpoint,
      key,
      userAgentSuffix: USER_AGENT_SUFFIX,
    });

    return new this(embeddings, {
      ...dbConfig,
      client,
    });
  }
}

/**
 * Extended search types for the AzureCosmosDBNoSQLVectorStoreRetriever.
 * Includes all base search types plus retriever-specific options.
 */
export const AzureCosmosDBNoSQLRetrieverSearchType = {
  /** Similarity search (alias for Vector) */
  Similarity: "similarity",
  ...AzureCosmosDBNoSQLSearchType,
  /** Maximal Marginal Relevance search */
  MMR: "mmr",
} as const;

/** Search type for the AzureCosmosDBNoSQLVectorStoreRetriever. */
export type AzureCosmosDBNoSQLRetrieverSearchType =
  (typeof AzureCosmosDBNoSQLRetrieverSearchType)[keyof typeof AzureCosmosDBNoSQLRetrieverSearchType];

/** Array of all allowed retriever search types for validation. */
export const AzureCosmosDBNoSQLRetrieverSearchTypes = Object.values(
  AzureCosmosDBNoSQLRetrieverSearchType
) as AzureCosmosDBNoSQLRetrieverSearchType[];

/**
 * Search parameters for the AzureCosmosDBNoSQLVectorStoreRetriever.
 */
export interface AzureCosmosDBNoSQLRetrieverSearchKwargs extends AzureCosmosDBNoSQLFilterType {
  /** Score threshold for threshold-based search types. */
  scoreThreshold?: number;
  /** Number of documents to fetch before MMR reranking. */
  fetchK?: number;
  /** Lambda parameter for MMR (0 = max diversity, 1 = max relevance). */
  lambda?: number;
}

/**
 * Input configuration for the AzureCosmosDBNoSQLVectorStoreRetriever.
 */
export interface AzureCosmosDBNoSQLVectorStoreRetrieverInput {
  /** The vector store instance. */
  vectorStore: AzureCosmosDBNoSQLVectorStore;
  /** The search type to use. Defaults to "similarity" (same as "vector"). */
  searchType?: AzureCosmosDBNoSQLRetrieverSearchType;
  /** Number of documents to return. */
  k?: number;
  /** Search parameters including filter options. */
  searchKwargs?: AzureCosmosDBNoSQLRetrieverSearchKwargs;
  /** Optional tags. */
  tags?: string[];
  /** Optional metadata. */
  metadata?: Record<string, unknown>;
  /** Optional verbose flag. */
  verbose?: boolean;
}

/**
 * Retriever class for Azure Cosmos DB for NoSQL vector store.
 * Supports multiple search types including vector, full-text, hybrid, and MMR.
 */
export class AzureCosmosDBNoSQLVectorStoreRetriever extends VectorStoreRetriever<AzureCosmosDBNoSQLVectorStore> {
  static lc_name() {
    return "AzureCosmosDBNoSQLVectorStoreRetriever";
  }

  get lc_namespace() {
    return ["langchain", "retrievers", "azure_cosmosdb_nosql"];
  }

  /** The search type to use. */
  cosmosSearchType: AzureCosmosDBNoSQLRetrieverSearchType;

  /** Search parameters including filter options. */
  searchKwargs: AzureCosmosDBNoSQLRetrieverSearchKwargs;

  constructor(input: AzureCosmosDBNoSQLVectorStoreRetrieverInput) {
    super({
      vectorStore: input.vectorStore,
      k: input.k,
      tags: input.tags,
      metadata: input.metadata,
      verbose: input.verbose,
    });
    this.cosmosSearchType = input.searchType ?? "similarity";
    this.k = input.k ?? 4;
    this.searchKwargs = input.searchKwargs ?? {};

    // Validate search type
    if (
      !AzureCosmosDBNoSQLRetrieverSearchTypes.includes(this.cosmosSearchType)
    ) {
      throw new Error(
        `Invalid search type "${this.cosmosSearchType}". Valid options are: ${AzureCosmosDBNoSQLRetrieverSearchTypes.join(", ")}`
      );
    }
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    const {
      scoreThreshold = 0.5,
      fetchK = 20,
      lambda = 0.5,
      ...filterOptions
    } = this.searchKwargs ?? {};

    const filter: AzureCosmosDBNoSQLFilterType = filterOptions;

    switch (this.cosmosSearchType) {
      case "similarity":
      case "vector": {
        return this.vectorStore.similaritySearch(query, this.k, filter);
      }

      case "vector_score_threshold": {
        const results = await this.vectorStore.vectorSearchWithThreshold(
          query,
          this.k,
          scoreThreshold,
          filter
        );
        return results.map(([doc]) => doc);
      }

      case "full_text_search": {
        const results = await this.vectorStore.fullTextSearch(
          query,
          this.k,
          filter
        );
        return results.map(([doc]) => doc);
      }

      case "full_text_ranking": {
        const results = await this.vectorStore.fullTextRanking(this.k, filter);
        return results.map(([doc]) => doc);
      }

      case "hybrid": {
        const results = await this.vectorStore.hybridSearchWithScore(
          query,
          this.k,
          filter
        );
        return results.map(([doc]) => doc);
      }

      case "hybrid_score_threshold": {
        const results = await this.vectorStore.hybridSearchWithThreshold(
          query,
          this.k,
          scoreThreshold,
          filter
        );
        return results.map(([doc]) => doc);
      }

      case "mmr": {
        return this.vectorStore.maxMarginalRelevanceSearch(query, {
          k: this.k,
          fetchK,
          lambda,
          filter,
        });
      }

      default:
        throw new Error(`Unsupported search type: ${this.cosmosSearchType}`);
    }
  }
}
