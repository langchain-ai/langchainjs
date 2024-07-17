import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BulkOperationResponse,
  BulkOperationType,
  Container,
  ContainerRequest,
  CosmosClient,
  DatabaseRequest,
  IndexingPolicy,
  OperationInput,
  SqlParameter,
  SqlQuerySpec,
  VectorEmbeddingPolicy,
} from "@azure/cosmos";

/** Azure Cosmos DB for NoSQL query filter. */
export type AzureCosmosDBNoSQLQueryFilter = string | SqlQuerySpec;

/** Azure AI Search filter type. */
export type AzureCosmosDBNoSQLFilterType = {
  /**
   * SQL WHERE clause to use add to the vector search query.
   * @example 'c.category = "cars"'
   */
  filterWhereClause?: AzureCosmosDBNoSQLQueryFilter;
  /** Determines whether or not to include the embeddings in the search results. */
  includeEmbeddings?: boolean;
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
  readonly databaseName?: string;
  readonly containerName?: string;
  readonly textKey?: string;
  readonly metadataKey?: string;
}

const USER_AGENT_PREFIX = "langchainjs-azure-cosmosdb-nosql";
const MAX_BATCH_SIZE = 100;

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
      endpoint: "AZURE_COSMOSDB_NOSQL_CONNECTION_STRING",
    };
  }

  private readonly initPromise: Promise<void>;

  private readonly client: CosmosClient;

  private container: Container;

  private readonly textKey: string;

  private readonly metadataKey: string;

  private embeddingKey: string;

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

    if (!dbConfig.client && !connectionString) {
      throw new Error(
        "Azure Cosmos DB client or connection string must be set."
      );
    }

    if (!dbConfig.client) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let [endpoint, key] = connectionString!.split(";");
      endpoint = endpoint.split("=")[1];
      key = key.split("=")[1];

      this.client = new CosmosClient({
        endpoint,
        key,
        userAgentSuffix: USER_AGENT_PREFIX,
      });
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
        },
      ];
    }

    if (!indexingPolicy.vectorIndexes?.length) {
      indexingPolicy.vectorIndexes = [
        {
          path: "/vector",
          type: "quantizedFlat",
        },
      ];
    }

    this.embeddingKey = vectorEmbeddingPolicy.vectorEmbeddings[0].path.slice(1);
    if (!this.embeddingKey) {
      throw new Error("AzureCosmosDBNoSQLVectorStore requires a valid vectorEmbeddings path");
    }

    // Start initialization, but don't wait for it to finish here
    this.initPromise = this.init(client, databaseName, containerName, {
      vectorEmbeddingPolicy,
      indexingPolicy,
      createContainerOptions: dbConfig.createContainerOptions,
      createDatabaseOptions: dbConfig.createDatabaseOptions,
    }).catch((error) => {
      console.error("Error during Azure Cosmos DB initialization:", error);
    });
  }

  /**
   * Removes specified documents from the AzureCosmosDBNoSQLVectorStore.
   * If no IDs or filter are specified, all documents will be removed.
   * @param params Parameters for the delete operation.
   * @returns A promise that resolves when the documents have been removed.
   */
  async delete(params: AzureCosmosDBNoSqlDeleteParams = {}): Promise<void> {
    await this.initPromise;

    if (params.ids && params.filter) {
      throw new Error(
        `AzureCosmosDBNoSQLVectorStore delete requires either "ids" or "filter" to be set in the params object, not both`
      );
    }

    let ids: string[];
    let query: AzureCosmosDBNoSQLQueryFilter | undefined = params.filter;

    // Delete all documents
    if (!params.ids && !params.filter) {
      query = "SELECT * FROM c";
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

    // Split ids into batches
    const promises: Promise<BulkOperationResponse>[] = [];

    while (ids.length) {
      const batchIds = ids.splice(0, MAX_BATCH_SIZE);
      const operations: OperationInput[] = batchIds.map((id) => ({
        operationType: BulkOperationType.Delete,
        id,
      }));
      promises.push(this.container.items.bulk(operations));
    }

    await Promise.all(promises);
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
    await this.initPromise;
    const docs = vectors.map((embedding, idx) => ({
      [this.textKey]: documents[idx].pageContent,
      [this.embeddingKey]: embedding,
      [this.metadataKey]: documents[idx].metadata,
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
    await this.initPromise;

    let where = "";
    let whereParams: SqlParameter[] = [];
    if (filter?.filterWhereClause) {
      if (typeof filter.filterWhereClause === "string") {
        where = `WHERE ${filter.filterWhereClause} `;
      } else {
        where = `WHERE ${filter.filterWhereClause.query} `;
        whereParams = filter.filterWhereClause.parameters ?? [];
      }
    }

    const embeddings = filter?.includeEmbeddings
      ? `c[@embeddingKey] AS vector, `
      : "";
    const query = `SELECT TOP @k c.id, ${embeddings}c[@textKey] AS text, c[@metadataKey] AS metadata, VectorDistance(c[@embeddingKey], @vector) AS similarityScore FROM c${where} ORDER BY VectorDistance(c[@embeddingKey], @vector)`;

    const { resources: items } = await this.container.items
      .query({
        query,
        parameters: [
          ...whereParams,
          { name: "@k", value: k },
          { name: "@textKey", value: this.textKey },
          { name: "@metadataKey", value: this.metadataKey },
          { name: "@embeddingKey", value: this.embeddingKey },
          { name: "@vector", value: queryVector },
        ],
      })
      .fetchAll();

    const docsAndScores = items.map(
      (item) =>
        [
          new Document({
            id: item.id,
            pageContent: item.text,
            metadata: {
              ...(item.metadata ?? {}),
              ...(filter?.includeEmbeddings ? { vector: item.vector } : {}),
            }
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

    const queryEmbedding = await this.embeddings.embedQuery(query);
    const docs = await this.similaritySearchVectorWithScore(
      queryEmbedding,
      fetchK
    );
    const embeddingList = docs.map((doc) => doc[0].metadata[this.embeddingKey]);

    // Re-rank the results using MMR
    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      lambda,
      k
    );

    const mmrDocs = mmrIndexes.map((index) => docs[index][0]);
    return mmrDocs;
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
}