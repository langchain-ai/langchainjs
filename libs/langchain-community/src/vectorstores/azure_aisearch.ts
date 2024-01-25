import * as uuid from "uuid";
import {
  SearchClient,
  SearchIndexClient,
  AzureKeyCredential,
  IndexingResult,
  SearchIndex,
  SearchIndexingBufferedSender,
  VectorFilterMode,
} from "@azure/search-documents";
import {
  MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/**
 * Azure AI Search query type.
 */
export const AzureAISearchQueryType = {
  /** Vector search. */
  Similarity: "similarity",
  /** Hybrid full text and vector search. */
  SimilarityHybrid: "similarity_hybrid",
  /** Hybrid full text and vector search with semantic ranking. */
  SemanticHybrid: "semantic_hybrid",
} as const;

/**
 * Azure AI Search query type.
 */
export type AzureAISearchQueryType =
  (typeof AzureAISearchQueryType)[keyof typeof AzureAISearchQueryType];

/**
 * Azure AI Search settings.
 */
export interface AzureAISearchQueryOptions {
  readonly type: AzureAISearchQueryType;
  readonly semanticConfigurationName?: string;
}

/**
 * Configuration options for the `AzureAISearchStore` constructor.
 */
export interface AzureAISearchConfig {
  readonly client?: SearchClient<AzureAISearchDocument>;
  readonly indexName?: string;
  readonly endpoint?: string;
  readonly key?: string;
  readonly search: AzureAISearchQueryOptions;
}

/**
 * Azure AI Search options metadata schema.
 * If yout want to add custom data, use the attributes property.
 */
export type AzureAISearchDocumentMetadata = {
  source: string;
  attributes?: Array<{ key: string; value: string }>;
  embedding?: number[];
};

/**
 * Azure AI Search indexed document.
 */
export type AzureAISearchDocument = {
  id: string;
  content: string;
  content_vector: number[];
  metadata: AzureAISearchDocumentMetadata;
};

/**
 * Azure AI Search options for adding documents.
 */
export type AzureAISearchAddDocumentsOptions = {
  ids?: string[];
};

/**
 * Azure AI Search filter type.
 */
export type AzureAISearchFilterType = {
  /** OData filter. */
  filterExpression?: string;
  /** Determines whether or not filters are applied before or after the vector search is performed. */
  vectorFilterMode?: VectorFilterMode;
  /** Determines whether or not to include the embeddings in the search results. */
  includeEmbeddings?: boolean;
};

const DEFAULT_FIELD_ID = "id";
const DEFAULT_FIELD_CONTENT = "content";
const DEFAULT_FIELD_CONTENT_VECTOR = "content_vector";
const DEFAULT_FIELD_METADATA = "metadata";
const DEFAULT_FIELD_METADATA_SOURCE = "source";
const DEFAULT_FIELD_METADATA_ATTRS = "attributes";

/**
 * Azure AI Search vector store.
 * To use this, you should have:
 * - the `@azure/search-documents` NPM package installed
 * - an endpoint and key to the Azure AI Search instance
 *
 * If you directly provide a `SearchClient` instance, you need to ensure that
 * an index has been created. When using and endpoint and key, the index will
 * be created automatically if it does not exist.
 */
export class AzureAISearchVectorStore extends VectorStore {
  declare FilterType: AzureAISearchFilterType;

  get lc_secrets(): { [key: string]: string } {
    return {
      endpoint: "AZURE_AISEARCH_ENDPOINT",
      key: "AZURE_AISEARCH_KEY",
    };
  }

  _vectorstoreType(): string {
    return "azure_aisearch";
  }

  private readonly initPromise: Promise<void>;

  private readonly client: SearchClient<AzureAISearchDocument>;

  private readonly indexName: string;

  private readonly options: AzureAISearchQueryOptions;

  constructor(embeddings: EmbeddingsInterface, config: AzureAISearchConfig) {
    super(embeddings, config);

    const endpoint =
      config.endpoint ?? getEnvironmentVariable("AZURE_AISEARCH_ENDPOINT");
    const key = config.key ?? getEnvironmentVariable("AZURE_AISEARCH_KEY");

    if (!config.client && (!endpoint || !key)) {
      throw new Error(
        "Azure AI Search client or endpoint and key must be set."
      );
    }

    this.indexName = config.indexName ?? "vectorsearch";

    if (!config.client) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const credential = new AzureKeyCredential(key!);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.client = new SearchClient(endpoint!, this.indexName, credential);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const indexClient = new SearchIndexClient(endpoint!, credential);

      // Start initialization, but don't wait for it to finish here
      this.initPromise = this.ensureIndexExists(indexClient).catch((error) => {
        console.error(
          "Error during Azure AI Search index initialization:",
          error
        );
      });
    } else {
      this.client = config.client;
    }

    this.options = config.search;
    this.embeddings = embeddings;
  }

  /**
   * Removes specified documents from the AzureAISearchVectorStore using IDs or a filter.
   * @param params Object that includes either an array of IDs or a filter for the data to be deleted.
   * @returns A promise that resolves when the documents have been removed.
   */
  async delete(params: {
    ids?: string | string[];
    filter?: AzureAISearchFilterType;
  }) {
    if (!params.ids && !params.filter) {
      throw new Error(
        `Azure AI Search delete requires either "ids" or "filter" to be set in the params object`
      );
    }
    if (params.ids) {
      await this.deleteById(params.ids);
    }
    if (params.filter) {
      await this.deleteMany(params.filter);
    }
  }

  /**
   * Removes specified documents from the AzureAISearchVectorStore using a filter.
   * @param filter Filter options to find documents to delete.
   * @returns A promise that resolves when the documents have been removed.
   */
  private async deleteMany(
    filter: AzureAISearchFilterType
  ): Promise<IndexingResult[]> {
    if (!filter.filterExpression) {
      throw new Error(
        `Azure AI Search deleteMany requires "filterExpression" to be set in the filter object`
      );
    }

    const { results } = await this.client.search("*", {
      filter: filter.filterExpression,
    });

    const docs: AzureAISearchDocument[] = [];
    for await (const item of results) {
      docs.push(item.document);
    }

    const deleteResults: IndexingResult[] = [];
    const bufferedClient =
      new SearchIndexingBufferedSender<AzureAISearchDocument>(
        this.client,
        (entity) => entity.id
      );
    bufferedClient.on("batchSucceeded", (response) => {
      deleteResults.push(...response.results);
    });
    bufferedClient.on("batchFailed", (response) => {
      throw new Error(
        `Azure AI Search deleteDocuments batch failed: ${response}`
      );
    });

    await bufferedClient.deleteDocuments(docs);
    await bufferedClient.flush();
    await bufferedClient.dispose();

    return deleteResults;
  }

  /**
   * Removes specified documents from the AzureAISearchVectorStore.
   * @param ids IDs of the documents to be removed.
   * @returns A promise that resolves when the documents have been removed.
   */
  private async deleteById(ids: string | string[]): Promise<IndexingResult[]> {
    await this.initPromise;

    const docsIds = Array.isArray(ids) ? ids : [ids];
    const docs: { id: string }[] = docsIds.map((id) => ({ id }));

    const deleteResults: IndexingResult[] = [];
    const bufferedClient = new SearchIndexingBufferedSender<{ id: string }>(
      this.client,
      (entity) => entity.id
    );
    bufferedClient.on("batchSucceeded", (response) => {
      deleteResults.push(...response.results);
    });
    bufferedClient.on("batchFailed", (response) => {
      throw new Error(
        `Azure AI Search deleteDocuments batch failed: ${response}`
      );
    });

    await bufferedClient.deleteDocuments(docs);
    await bufferedClient.flush();
    await bufferedClient.dispose();

    return deleteResults;
  }

  /**
   * Adds documents to the AzureAISearchVectorStore.
   * @param documents The documents to add.
   * @param options Options for adding documents.
   * @returns A promise that resolves to the ids of the added documents.
   */
  async addDocuments(
    documents: Document[],
    options?: AzureAISearchAddDocumentsOptions
  ) {
    const texts = documents.map(({ pageContent }) => pageContent);
    const embeddings: number[][] = await this.embeddings.embedDocuments(texts);
    const results = await this.addVectors(embeddings, documents, options);

    return results;
  }

  /**
   * Adds vectors to the AzureAISearchVectorStore.
   * @param vectors Vectors to be added.
   * @param documents Corresponding documents to be added.
   * @param options Options for adding documents.
   * @returns A promise that resolves to the ids of the added documents.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: AzureAISearchAddDocumentsOptions
  ): Promise<string[]> {
    const ids = options?.ids ?? documents.map(() => uuid.v4());
    const entities: AzureAISearchDocument[] = documents.map((doc, idx) => ({
      id: ids[idx],
      content: doc.pageContent,
      content_vector: vectors[idx],
      metadata: {
        source: doc.metadata?.source,
        attributes: doc.metadata?.attributes ?? [],
      },
    }));

    await this.initPromise;

    const bufferedClient =
      new SearchIndexingBufferedSender<AzureAISearchDocument>(
        this.client,
        (entity) => entity.id
      );
    bufferedClient.on("batchFailed", (response) => {
      throw new Error(
        `Azure AI Search uploadDocuments batch failed: ${response}`
      );
    });

    await bufferedClient.uploadDocuments(entities);
    await bufferedClient.flush();
    await bufferedClient.dispose();

    return ids;
  }

  /**
   * Performs a similarity search using query type specified in configuration.
   * @param query Query text for the similarity search.
   * @param k=4 Number of nearest neighbors to return.
   * @param filter Optional filter options for the documents.
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
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
   * Performs a similarity search using query type specified in configuration.
   * @param query Query text for the similarity search.
   * @param k=4 Number of nearest neighbors to return.
   * @param filter Optional filter options for the documents.
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
   */
  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    const searchType = this.options.type;

    if (searchType === AzureAISearchQueryType.Similarity) {
      return this.similaritySearchVectorWithScore(
        await this.embeddings.embedQuery(query),
        k,
        filter
      );
    } else if (searchType === AzureAISearchQueryType.SimilarityHybrid) {
      return this.hybridSearchVectorWithScore(
        query,
        await this.embeddings.embedQuery(query),
        k,
        filter
      );
    } else if (searchType === AzureAISearchQueryType.SemanticHybrid) {
      return this.semanticHybridSearchVectorWithScore(
        query,
        await this.embeddings.embedQuery(query),
        k,
        filter
      );
    }

    throw new Error(`Unrecognized search type '${searchType}'`);
  }

  /**
   * Performs a hybrid search using query text.
   * @param query Query text for the similarity search.
   * @param queryVector Query vector for the similarity search.
   *    If not provided, the query text will be embedded.
   * @param k=4 Number of nearest neighbors to return.
   * @param filter Optional filter options for the documents.
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
   */
  async hybridSearchVectorWithScore(
    query: string,
    queryVector?: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    const vector = queryVector ?? (await this.embeddings.embedQuery(query));

    await this.initPromise;
    const { results } = await this.client.search(query, {
      vectorSearchOptions: {
        queries: [
          {
            kind: "vector",
            vector,
            kNearestNeighborsCount: k,
            fields: [DEFAULT_FIELD_CONTENT_VECTOR],
          },
        ],
        filterMode: filter?.vectorFilterMode,
      },
      filter: filter?.filterExpression,
      top: k,
    });

    const docsWithScore: [Document, number][] = [];

    for await (const item of results) {
      const document = new Document<AzureAISearchDocumentMetadata>({
        pageContent: item.document[DEFAULT_FIELD_CONTENT],
        metadata: {
          ...item.document[DEFAULT_FIELD_METADATA],
        },
      });
      if (filter?.includeEmbeddings) {
        document.metadata.embedding =
          item.document[DEFAULT_FIELD_CONTENT_VECTOR];
      }
      docsWithScore.push([document, item.score]);
    }

    return docsWithScore;
  }

  /**
   * Performs a hybrid search with semantic reranker using query text.
   * @param query Query text for the similarity search.
   * @param queryVector Query vector for the similarity search.
   *    If not provided, the query text will be embedded.
   * @param k=4 Number of nearest neighbors to return.
   * @param filter Optional filter options for the documents.
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
   */
  async semanticHybridSearchVectorWithScore(
    query: string,
    queryVector?: number[],
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    const vector = queryVector ?? (await this.embeddings.embedQuery(query));

    await this.initPromise;
    const { results } = await this.client.search(query, {
      vectorSearchOptions: {
        queries: [
          {
            kind: "vector",
            vector,
            kNearestNeighborsCount: k,
            fields: [DEFAULT_FIELD_CONTENT_VECTOR],
          },
        ],
        filterMode: filter?.vectorFilterMode,
      },
      filter: filter?.filterExpression,
      top: k,
      queryType: "semantic",
      semanticSearchOptions: {
        configurationName: "semantic-search-config",
      },
    });

    const docsWithScore: [Document, number][] = [];

    for await (const item of results) {
      const document = new Document<AzureAISearchDocumentMetadata>({
        pageContent: item.document[DEFAULT_FIELD_CONTENT],
        metadata: {
          ...item.document[DEFAULT_FIELD_METADATA],
        },
      });
      if (filter?.includeEmbeddings) {
        document.metadata.embedding =
          item.document[DEFAULT_FIELD_CONTENT_VECTOR];
      }
      docsWithScore.push([document, item.score]);
    }

    return docsWithScore;
  }

  /**
   * Performs a similarity search on the vectors stored in the collection.
   * @param queryVector Query vector for the similarity search.
   * @param k=4 Number of nearest neighbors to return.
   * @param filter Optional filter options for the documents.
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    await this.initPromise;

    const { results } = await this.client.search("*", {
      vectorSearchOptions: {
        queries: [
          {
            kind: "vector",
            vector: query,
            kNearestNeighborsCount: k,
            fields: [DEFAULT_FIELD_CONTENT_VECTOR],
          },
        ],
        filterMode: filter?.vectorFilterMode,
      },
      filter: filter?.filterExpression,
    });

    const docsWithScore: [Document, number][] = [];

    for await (const item of results) {
      const document = new Document<AzureAISearchDocumentMetadata>({
        pageContent: item.document[DEFAULT_FIELD_CONTENT],
        metadata: {
          ...item.document[DEFAULT_FIELD_METADATA],
        },
      });
      if (filter?.includeEmbeddings) {
        document.metadata.embedding =
          item.document[DEFAULT_FIELD_CONTENT_VECTOR];
      }
      docsWithScore.push([document, item.score]);
    }

    return docsWithScore;
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
    const embeddingList = docs.map((doc) => doc[0].metadata.embedding);

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
        delete doc.metadata.embedding;
      }
      return doc;
    });
  }

  /**
   * Ensures that an index exists on the AzureAISearchVectorStore.
   * @param indexClient The Azure AI Search index client.
   * @returns A promise that resolves when the AzureAISearchVectorStore index has been initialized.
   * @protected
   */
  protected async ensureIndexExists(
    indexClient: SearchIndexClient
  ): Promise<void> {
    try {
      await indexClient.getIndex(this.indexName);
    } catch (e) {
      // Index does not exists, create it
      const searchIndex = await this.createSearchIndexDefinition(
        this.indexName
      );
      await indexClient.createIndex(searchIndex);
    }
  }

  /**
   * Prepares the search index definition for Azure AI Search.
   * @param indexName The name of the index.
   * @returns The SearchIndex object.
   * @protected
   */
  protected async createSearchIndexDefinition(
    indexName: string
  ): Promise<SearchIndex> {
    // Embed a test query to get the embedding dimensions
    const testEmbedding = await this.embeddings.embedQuery("test");
    const embeddingDimensions = testEmbedding.length;
    return {
      name: indexName,
      vectorSearch: {
        algorithms: [
          {
            name: "vector-search-algorithm",
            kind: "hnsw",
            parameters: {
              m: 4,
              efSearch: 500,
              metric: "cosine",
              efConstruction: 400,
            },
          },
        ],
        profiles: [
          {
            name: "vector-search-profile",
            algorithmConfigurationName: "vector-search-algorithm",
          },
        ],
      },
      semanticSearch: {
        defaultConfigurationName: "semantic-search-config",
        configurations: [
          {
            name: "semantic-search-config",
            prioritizedFields: {
              contentFields: [
                {
                  name: DEFAULT_FIELD_CONTENT,
                },
              ],
              keywordsFields: [
                {
                  name: DEFAULT_FIELD_CONTENT,
                },
              ],
            },
          },
        ],
      },
      fields: [
        {
          name: DEFAULT_FIELD_ID,
          filterable: true,
          key: true,
          type: "Edm.String",
        },
        {
          name: DEFAULT_FIELD_CONTENT,
          searchable: true,
          filterable: true,
          type: "Edm.String",
        },
        {
          name: DEFAULT_FIELD_CONTENT_VECTOR,
          searchable: true,
          type: "Collection(Edm.Single)",
          vectorSearchDimensions: embeddingDimensions,
          vectorSearchProfileName: "vector-search-profile",
        },
        {
          name: DEFAULT_FIELD_METADATA,
          type: "Edm.ComplexType",
          fields: [
            {
              name: DEFAULT_FIELD_METADATA_SOURCE,
              type: "Edm.String",
              filterable: true,
            },
            {
              name: DEFAULT_FIELD_METADATA_ATTRS,
              type: "Collection(Edm.ComplexType)",
              fields: [
                {
                  name: "key",
                  type: "Edm.String",
                  filterable: true,
                },
                {
                  name: "value",
                  type: "Edm.String",
                  filterable: true,
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Static method to create an instance of AzureAISearchVectorStore from a
   * list of texts. It first converts the texts to vectors and then adds
   * them to the collection.
   * @param texts List of texts to be converted to vectors.
   * @param metadatas Metadata for the texts.
   * @param embeddings Embeddings to be used for conversion.
   * @param config Database configuration for Azure AI Search.
   * @returns Promise that resolves to a new instance of AzureAISearchVectorStore.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    config: AzureAISearchConfig
  ): Promise<AzureAISearchVectorStore> {
    const docs: Document<AzureAISearchDocumentMetadata>[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return AzureAISearchVectorStore.fromDocuments(docs, embeddings, config);
  }

  /**
   * Static method to create an instance of AzureAISearchVectorStore from a
   * list of documents. It first converts the documents to vectors and then
   * adds them to the database.
   * @param docs List of documents to be converted to vectors.
   * @param embeddings Embeddings to be used for conversion.
   * @param config Database configuration for Azure AI Search.
   * @returns Promise that resolves to a new instance of AzureAISearchVectorStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    config: AzureAISearchConfig,
    options?: AzureAISearchAddDocumentsOptions
  ): Promise<AzureAISearchVectorStore> {
    const instance = new this(embeddings, config);
    await instance.addDocuments(docs, options);
    return instance;
  }
}
