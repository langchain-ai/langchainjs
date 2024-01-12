import * as uuid from "uuid";
import { SearchClient, SearchIndexClient, AzureKeyCredential, IndexingResult, SearchIndex } from "@azure/search-documents";
import {
  MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

// TODO: Allow to override default fields

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
export type AzureAISearchQueryType = (typeof AzureAISearchQueryType)[keyof typeof AzureAISearchQueryType];

/**
 * Azure AI Search settings.
 */
export interface AzureAISearchQueryOptions {
  readonly type: AzureAISearchQueryType;
  readonly semantic?: string;
  readonly semanticConfigurationName?: string;
  readonly semanticQueryLanguage?: string;

  // fields: Optional[List[SearchField]] = None,
  // vector_search: Optional[VectorSearch] = None,
  // semantic_settings: Optional[Union[SemanticSearch, SemanticSettings]] = None,
  // scoring_profiles: Optional[List[ScoringProfile]] = None,
  // default_scoring_profile: Optional[str] = None,
  // cors_options: Optional[CorsOptions] = None,
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
  /**
   * The amount of documents to chunk by when adding vectors.
   * @default 100
   */
  readonly chunkSize?: number;
  /**
   * The amount of documents to embed at once when adding documents.
   * Note that some providers like Azure OpenAI can only embed 16 documents
   * at a time.
   * @default 16
   */
  readonly embeddingBatchSize?: number;
}

/**
 * Azure AI Search options metadata schema.
 * If yout want to add custom data, use the attributes property.
 */
export type AzureAISearchDocumentMetadata = {
  source: string;
  attributes?: Array<{ key: string; value: string; }>;
}

/**
 * Azure AI Search indexed document.
 */
export type AzureAISearchDocument = {
  id: string;
  content: string;
  content_vector: number[];
  metadata: AzureAISearchDocumentMetadata;
}

/**
 * Azure AI Search options for adding documents.
 */
export type AzureAISearchAddDocumentsOptions = {
  ids?: string[];
}

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
  declare FilterType: string;

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

  private readonly chunkSize: number;

  private readonly embeddingBatchSize: number;

  private readonly options: AzureAISearchQueryOptions;

  private constructor(embeddings: EmbeddingsInterface, config: AzureAISearchConfig) {
    super(embeddings, config);

    const endpoint = config.endpoint ?? getEnvironmentVariable("AZURE_AISEARCH_ENDPOINT");
    const key = config.key ?? getEnvironmentVariable("AZURE_AISEARCH_KEY");

    if (!config.client && (!endpoint && !key)) {
      throw new Error(
        "Azure AI Search client or connection string must be set."
      );
    }

    this.indexName = config.indexName ?? "vectorSearchIndex";
    this.chunkSize = config.chunkSize ?? 100;
    this.embeddingBatchSize = config.embeddingBatchSize ?? 16;

    if (!config.client) {
      const credential = new AzureKeyCredential(key!);
      this.client = new SearchClient(endpoint!, this.indexName, credential);
      const indexClient = new SearchIndexClient(endpoint!, credential);

      // Start initialization, but don't wait for it to finish here
      this.initPromise = this.ensureIndexExists(indexClient).catch(
        (error) => {
          console.error("Error during Azure Cosmos DB initialization:", error);
        }
      );
    }

    this.options = config.search;
    this.embeddings = embeddings;
  }

  /**
   * Removes specified documents from the AzureAISearchVectorStore using a filter.
   * @param filter OData filter to find documents to delete.
   * @returns A promise that resolves when the documents have been removed.
   */
  async deleteByFilter(filter: string): Promise<IndexingResult[]> {
    const { results } = await this.client.search("", {
      filter,
    });

    const ids: string[] = [];
    for await (const item of results) {
      ids.push(item.document.id);
    }

    const { results: deleteResults } = await this.client.deleteDocuments(DEFAULT_FIELD_ID, ids);
    return deleteResults;
  }

  /**
   * Removes specified documents from the AzureAISearchVectorStore.
   * @param ids IDs of the documents to be removed.
   * @returns A promise that resolves when the documents have been removed.
   */
  async deleteById(ids: string | string[]): Promise<IndexingResult[]> {
    await this.initPromise;
    const { results } = await this.client.deleteDocuments(DEFAULT_FIELD_ID, Array.isArray(ids) ? ids : [ids]);
    return results;
  }

  /**
   * Method for adding documents to the AzureAISearchVectorStore. It first converts
   * the documents to texts and then adds them as vectors.
   * @param documents The documents to add.
   * @param options Options for adding documents.
   * @returns A promise that resolves to the ids of the added documents.
   */
  async addDocuments(
    documents: Document<AzureAISearchDocumentMetadata>[],
    options?: AzureAISearchAddDocumentsOptions
  ) {
    const texts = documents.map(({ pageContent }) => pageContent);
    const results: string[] = [];

    for (let i = 0; i < texts.length; i += this.embeddingBatchSize) {
      const batch = texts.slice(i, i + this.embeddingBatchSize);
      const docsBatch = documents.slice(i, i + this.embeddingBatchSize);
      const batchEmbeddings: number[][] = await this.embeddings.embedDocuments(batch);
      const batchResult = await this.addVectors(
        batchEmbeddings,
        docsBatch,
        options
      );

      results.push(...batchResult);
    }

    return results;
  }

  /**
   * Method for adding vectors to the AzureAISearchVectorStore.
   * @param vectors Vectors to be added.
   * @param documents Corresponding documents to be added.
   * @param options Options for adding documents.
   * @returns A promise that resolves to the ids of the added documents.
   */
  async addVectors(
    vectors: number[][],
    documents: Document<AzureAISearchDocumentMetadata>[],
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
      }
    }));

    await this.initPromise;
    for (let i = 0; i < entities.length; i += this.chunkSize) {
      const chunk = entities.slice(i, i + this.chunkSize);
      await this.client.uploadDocuments(chunk, { throwOnAnyFailure: true });
    }

    return ids;
  }

  /**
   * Perform a similarity search using query type specified on Configuration.
   *
   * @param query
   * @param k
   * @param filter
   */
  // async similaritySearch(
  //   query: string,
  //   k = 4,
  //   filter: this["FilterType"] | undefined = undefined,
  // ): Promise<Document[]> {
  //   const searchType = this.params.search.type;
  //   let results: [Document, number][] = [];

  //   if (searchType === "similarity") {
  //     results = await this.similaritySearchVectorWithScore(
  //       await this.embeddings.embedQuery(query),
  //       k,
  //       filter
  //     );
  //   } else if (searchType === "similarity_hybrid") {
  //     results = await this.hybridSearchVectorWithScore(
  //       query,
  //       await this.embeddings.embedQuery(query),
  //       k,
  //       filter
  //     );
  //   } else if (searchType === "semantic_hybrid") {
  //     results = await this.semanticHybridSearchVectorWithScore(
  //       query,
  //       await this.embeddings.embedQuery(query),
  //       k,
  //       filter
  //     );
  //   } else {
  //     throw new Error(`Unrecognized search type '${searchType}'`);
  //   }

  //   return results.map((result) => result[0]);
  // }

  /**
   * Perform a similarity search using query type specified on Configuration.
   *
   * @param query
   * @param k
   * @param filter
   */
  // async similaritySearchWithScore(
  //   query: string,
  //   k = 4,
  //   filter: this["FilterType"] | undefined = undefined,
  // ): Promise<[Document, number][]> {
  //   const searchType = this.params.search.type;

  //   if (searchType === "similarity") {
  //     return this.similaritySearchVectorWithScore(
  //       await this.embeddings.embedQuery(query),
  //       k,
  //       filter
  //     );
  //   } else if (searchType === "similarity_hybrid") {
  //     return this.hybridSearchVectorWithScore(
  //       query,
  //       await this.embeddings.embedQuery(query),
  //       k,
  //       filter
  //     );
  //   } else if (searchType === "semantic_hybrid") {
  //     return this.semanticHybridSearchVectorWithScore(
  //       query,
  //       await this.embeddings.embedQuery(query),
  //       k,
  //       filter
  //     );
  //   }

  //   throw new Error(`Unrecognized search type '${searchType}'`);
  // }

  /**
   * Perform a hybrid search using text search.
   *
   * @param query
   * @param queryVectors
   * @param k
   * @param filter
   */
  // async hybridSearchVectorWithScore(
  //   query: string,
  //   queryVectors: number[],
  //   k: number,
  //   filter?: string
  // ): Promise<[Document, number][]> {
  //   const { results } = await this.client.search(query, {
  //     vectors: [{
  //       value: queryVectors,
  //       fields: [DEFAULT_FIELD_CONTENT_VECTOR],
  //       kNearestNeighborsCount: k,
  //     }],
  //     filter,
  //     top: k,
  //   });

  //   const docsWithScore: [Document, number][] = [];

  //   for await (const item of results) {
  //     const document = new Document<AzureAISearchDocumentMetadata>({
  //       pageContent: item.document.content,
  //       metadata: item.document.metadata,
  //     });

  //     docsWithScore.push([document, item.score]);
  //   }

  //   return docsWithScore;
  // }

  /**
   * Perform a hybrid search using Semantic configuration.
   *
   * @param query
   * @param queryVectors
   * @param k
   * @param filter
   */
  // async semanticHybridSearchVectorWithScore(
  //   query: string,
  //   queryVectors: number[],
  //   k: number,
  //   filter?: string
  // ): Promise<[Document, number][]> {
  //   const { results } = await this.client.search(query, {
  //     vectors: [{
  //       value: queryVectors,
  //       fields: [DEFAULT_FIELD_CONTENT_VECTOR],
  //       kNearestNeighborsCount: k,
  //     }],
  //     filter,
  //     top: k,
  //     queryType: "semantic",
  //     queryLanguage: this.params.search.language ?? "en-us",
  //     semanticConfiguration: this.params.search.semantic ?? "default",
  //     captions: "extractive",
  //     answers: "extractive",
  //   });

  //   const docsWithScore: [Document<AzureAISearchDocumentMetadata>, number][] = [];

  //   for await (const item of results) {
  //     const document = new Document<AzureAISearchDocumentMetadata>({
  //       pageContent: item.document.content,
  //       metadata: item.document.metadata,
  //     });

  //     docsWithScore.push([document, item.rerankerScore ?? item.score]);
  //   }

  //   return docsWithScore;
  // }

  /**
   * Method that performs a similarity search on the vectors stored in the
   * collection. It returns a list of documents and their corresponding
   * similarity scores.
   * @param queryVector Query vector for the similarity search.
   * @param k=4 Number of nearest neighbors to return.
   * @param filter string OData filter for the documents.
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: string
  ): Promise<[Document, number][]> {
    await this.initPromise;

    const { results } = await this.client.search("", {
      vectorSearchOptions: {
        queries: [{
          kind: "vector",
          vector: query,
          kNearestNeighborsCount: k,
        }],
      },
      searchFields: [DEFAULT_FIELD_CONTENT_VECTOR],
      filter,
    });

    const docsWithScore: [Document, number][] = [];

    for await (const item of results) {
      const document = new Document<AzureAISearchDocumentMetadata>({
        pageContent: item.document.content,
        metadata: item.document.metadata,
      });
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

    const queryEmbedding = await this.embeddings.embedQuery(query);
    const docs = await this.similaritySearchVectorWithScore(
      queryEmbedding,
      fetchK
    );
    const embeddingList = docs.map((doc) => doc[0].metadata[DEFAULT_FIELD_CONTENT_VECTOR]);

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
   * Ensures that an index exists on the AzureAISearchVectorStore.
   * @param indexClient The Azure AI Search index client.
   * @returns A promise that resolves when the AzureAISearchVectorStore index has been initialized.
   * @protected
   */
  protected async ensureIndexExists(indexClient: SearchIndexClient): Promise<void> {
    try {
      await indexClient.getIndex(this.indexName);
    } catch (e) {
      // Index does not exists, create it
      const searchIndex = this.createSearchIndexDefinition(this.indexName);
      await indexClient.createIndex(searchIndex);
    }
  }

  /**
   * Prepares the search index definition for Azure AI Search.
   * @param indexName The name of the index.
   * @returns The SearchIndex object.
   */
  protected createSearchIndexDefinition(indexName: string): SearchIndex {
    return {
      name: indexName,
      vectorSearch: {
        algorithms: [
          {
            name: "default",
            kind: "hnsw",
            parameters: {
              m: 4,
              efSearch: 500,
              metric: "cosine",
              efConstruction: 400
            }
          }
        ],
        profiles: [
          {
            name: "default",
            algorithmConfigurationName: "default",
          }
        ]
      },
      semanticSearch: {
        defaultConfigurationName: "default",
        configurations: [
          {
            name: "default",
            prioritizedFields: {
              contentFields: [{
                name: DEFAULT_FIELD_CONTENT,
              }],
              keywordsFields: [{
                name: DEFAULT_FIELD_CONTENT,
              }]
            }
          }
        ]
      },
      fields: [
        {
          name: DEFAULT_FIELD_ID,
          filterable: true,
          key: true,
          type: "Edm.String"
        },
        {
          name: DEFAULT_FIELD_CONTENT,
          searchable: true,
          filterable: true,
          type: "Edm.String"
        },
        {
          name: DEFAULT_FIELD_CONTENT_VECTOR,
          searchable: true,
          type: "Collection(Edm.Single)",
          vectorSearchDimensions: 1536,
          vectorSearchProfileName: "default"
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
              ]
            }
          ]
        }
      ]
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
    config: AzureAISearchConfig,
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
    docs: Document<AzureAISearchDocumentMetadata>[],
    embeddings: EmbeddingsInterface,
    config: AzureAISearchConfig,
  ): Promise<AzureAISearchVectorStore> {
    const instance = new this(embeddings, config);
    await instance.addDocuments(docs);
    return instance;
  }
}
