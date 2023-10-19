import * as uuid from "uuid";
import { SearchClient, SearchIndexClient, AzureKeyCredential, IndexingResult, SearchIndex } from "@azure/search-documents";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

/**
 * Azure Search - Type of query.
 */
export type AzureSearchType = "semantic_hybrid" | "similarity_hybrid" | "similarity";

/**
 * Azure search - Store DB Config.
 */
export type AzureSearchStoreParams = {
  client: {
    indexName: string;
    endpoint: string;
    credential: string;
  } | SearchClient<AzureSearchDocument>;
  search: {
    type: AzureSearchType;
    language?: string;
    semantic?: string;
  };
}

/**
 * Define metadata schema.
 *
 * If yout want to add custom data, use the attributes property.
 */
export type AzureSearchDocumentMetadata = {
  source: string;
  attributes?: Array<{ key: string; value: string; }>;
}

/**
 * Azure Search - Represents a document indexed.
 */
export type AzureSearchDocument = {
  id: string;
  content: string;
  content_vector: number[];
  metadata: AzureSearchDocumentMetadata;
}

/**
 * Azure Search - Options for adding documents.
 */
export type AzureSearchAddDocumentsOptions = {
  keys?: string[];
}

const DEFAULT_FIELD_ID = "id";
const DEFAULT_FIELD_CONTENT = "content";
const DEFAULT_FIELD_CONTENT_VECTOR = "content_vector";
const DEFAULT_FIELD_METADATA = "metadata";
const DEFAULT_FIELD_METADATA_SOURCE = "source";
const DEFAULT_FIELD_METADATA_ATTRS = "attributes";

/**
 * Vector store implementation for Azure Cognitive Search.
 */
export class AzureSearchStore extends VectorStore {
  declare FilterType: string;

  _vectorstoreType(): string {
    return "azure-search";
  }

  private readonly params: AzureSearchStoreParams;

  private readonly client: SearchClient<AzureSearchDocument>;

  private constructor(client: SearchClient<AzureSearchDocument>, params: AzureSearchStoreParams, embeddings: Embeddings) {
    super(embeddings, params);

    this.client = client;
    this.params = params;
    this.embeddings = embeddings;
  }

  /**
   * Upload documents into vector store.
   *
   * @param documents
   * @param options
   */
  async addDocuments(
    documents: Document<AzureSearchDocumentMetadata>[],
    options?: AzureSearchAddDocumentsOptions
  ) {
    const texts = documents.map(({ pageContent }) => pageContent);

    // Some providers like Azure OpenAI can only embed 16 documents at a time.
    const results: string[] = [];
    const batchSize = 16;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const docsBatch = documents.slice(i, i + batchSize);
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
   * Upload vectors into vector store.
   *
   * @param vectors
   * @param documents
   * @param options
   */
  async addVectors(
    vectors: number[][],
    documents: Document<AzureSearchDocumentMetadata>[],
    options?: AzureSearchAddDocumentsOptions
  ) {
    const keys = options?.keys ?? documents.map(() => uuid.v4());

    const entities: AzureSearchDocument[] = documents.map((doc, idx) => ({
      id: keys[idx],
      content: doc.pageContent,
      content_vector: vectors[idx],
      metadata: {
        source: doc.metadata?.source,
        attributes: doc.metadata?.attributes ?? [],
      }
    }));

    const chunkSize = 100;
    for (let i = 0; i < entities.length; i += chunkSize) {
      const chunk = entities.slice(i, i + chunkSize);

      await this.client.uploadDocuments(chunk, { throwOnAnyFailure: true });
    }

    return keys;
  }

  /**
   * Delete multiple documents by filter expression.
   *
   * @param filter OData filter to find documents to delete.
   * @returns
   */
  async deleteMany(filter: string): Promise<IndexingResult[]> {
    const { results } = await this.client.search("", {
      filter,
    });

    const keys: string[] = [];
    for await (const item of results) {
      keys.push(item.document.id);
    }

    const { results: deleteResults } = await this.client.deleteDocuments(DEFAULT_FIELD_ID, keys);

    return deleteResults;
  }

  /**
   * Delete document by key(s).
   *
   * @param key
   * @returns
   */
  async deleteByKey(key: string | string[]): Promise<IndexingResult[]> {
    const { results } = await this.client.deleteDocuments(DEFAULT_FIELD_ID, Array.isArray(key) ? key : [key]);

    return results;
  }

  /**
   * Perform a similarity search using query type specified on Configuration.
   *
   * @param query
   * @param k
   * @param filter
   */
  async similaritySearch(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
  ): Promise<Document[]> {
    const searchType = this.params.search.type;
    let results: [Document, number][] = [];

    if (searchType === "similarity") {
      results = await this.similaritySearchVectorWithScore(
        await this.embeddings.embedQuery(query),
        k,
        filter
      );
    } else if (searchType === "similarity_hybrid") {
      results = await this.hybridSearchVectorWithScore(
        query,
        await this.embeddings.embedQuery(query),
        k,
        filter
      );
    } else if (searchType === "semantic_hybrid") {
      results = await this.semanticHybridSearchVectorWithScore(
        query,
        await this.embeddings.embedQuery(query),
        k,
        filter
      );
    } else {
      throw new Error(`Unrecognized search type '${searchType}'`);
    }

    return results.map((result) => result[0]);
  }

  /**
   * Perform a similarity search using query type specified on Configuration.
   *
   * @param query
   * @param k
   * @param filter
   */
  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined,
  ): Promise<[Document, number][]> {
    const searchType = this.params.search.type;

    if (searchType === "similarity") {
      return this.similaritySearchVectorWithScore(
        await this.embeddings.embedQuery(query),
        k,
        filter
      );
    } else if (searchType === "similarity_hybrid") {
      return this.hybridSearchVectorWithScore(
        query,
        await this.embeddings.embedQuery(query),
        k,
        filter
      );
    } else if (searchType === "semantic_hybrid") {
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
   * Perform a hybrid search using text search.
   *
   * @param query
   * @param queryVectors
   * @param k
   * @param filter
   */
  async hybridSearchVectorWithScore(
    query: string,
    queryVectors: number[],
    k: number,
    filter?: string
  ): Promise<[Document, number][]> {
    const { results } = await this.client.search(query, {
      vectors: [{
        value: queryVectors,
        fields: [DEFAULT_FIELD_CONTENT_VECTOR],
        kNearestNeighborsCount: k,
      }],
      filter,
      top: k,
    });

    const docsWithScore: [Document, number][] = [];

    for await (const item of results) {
      const document = new Document<AzureSearchDocumentMetadata>({
        pageContent: item.document.content,
        metadata: item.document.metadata,
      });

      docsWithScore.push([document, item.score]);
    }

    return docsWithScore;
  }

  /**
   * Perform a hybrid search using Semantic configuration.
   *
   * @param query
   * @param queryVectors
   * @param k
   * @param filter
   */
  async semanticHybridSearchVectorWithScore(
    query: string,
    queryVectors: number[],
    k: number,
    filter?: string
  ): Promise<[Document, number][]> {
    const { results } = await this.client.search(query, {
      vectors: [{
        value: queryVectors,
        fields: [DEFAULT_FIELD_CONTENT_VECTOR],
        kNearestNeighborsCount: k,
      }],
      filter,
      top: k,
      queryType: "semantic",
      queryLanguage: this.params.search.language ?? "en-us",
      semanticConfiguration: this.params.search.semantic ?? "default",
      captions: "extractive",
      answers: "extractive",
    });

    const docsWithScore: [Document<AzureSearchDocumentMetadata>, number][] = [];

    for await (const item of results) {
      const document = new Document<AzureSearchDocumentMetadata>({
        pageContent: item.document.content,
        metadata: item.document.metadata,
      });

      docsWithScore.push([document, item.rerankerScore ?? item.score]);
    }

    return docsWithScore;
  }

  /**
   * Execute a vector similarity search.
   *
   * @param query
   * @param k
   * @param filter
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: string
  ): Promise<[Document, number][]> {
    const { results } = await this.client.search("", {
      vectors: [{
        value: query,
        fields: [DEFAULT_FIELD_CONTENT_VECTOR],
        kNearestNeighborsCount: k,
      }],
      filter,
    });

    const docsWithScore: [Document, number][] = [];

    for await (const item of results) {
      const document = new Document<AzureSearchDocumentMetadata>({
        pageContent: item.document.content,
        metadata: item.document.metadata,
      });

      docsWithScore.push([document, item.score]);
    }

    return docsWithScore;
  }

  /**
   * Ensure that index exists on Vector Store.
   *
   * @param dbConfig
   * @protected
   */
  protected static async ensureIndexExists(dbConfig: AzureSearchStoreParams): Promise<SearchClient<AzureSearchDocument>> {
    if (isSearchClient(dbConfig.client)) return dbConfig.client;

    const {indexName, endpoint} = dbConfig.client;
    const credential = new AzureKeyCredential(dbConfig.client.credential);

    const indexClient = new SearchIndexClient(endpoint, credential);

    try {
      await indexClient.getIndex(indexName);
    } catch (e) {
      // Index not exists.
      await indexClient.createIndex(makeSearchIndex(indexName));
    }

    return new SearchClient(endpoint, indexName, credential);
  }

  /**
   * Create instance of vector store and upload text's as Document's.
   *
   * @param texts
   * @param metadatas
   * @param embeddings
   * @param dbConfig
   */
  static async fromTexts(
    texts: string[],
    metadatas: AzureSearchDocumentMetadata[],
    embeddings: Embeddings,
    dbConfig: AzureSearchStoreParams,
  ): Promise<AzureSearchStore> {
    const docs: Document<AzureSearchDocumentMetadata>[] = [];

    // Transform texts into Documents.
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document<AzureSearchDocumentMetadata>({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }

    // Start with documents
    return this.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Create a new vector store instance and upload documents.
   *
   * @param docs
   * @param embeddings
   * @param dbConfig
   */
  static async fromDocuments(
    docs: Document<AzureSearchDocumentMetadata>[],
    embeddings: Embeddings,
    dbConfig: AzureSearchStoreParams,
  ): Promise<AzureSearchStore> {
    const instance = await this.create(dbConfig, embeddings);

    // Start a client with documents.
    await instance.addDocuments(docs);

    return instance;
  }

  /**
   * Create a new vector store instance.
   *
   * @param dbConfig
   * @param embeddings
   */
  static async create(
    dbConfig: AzureSearchStoreParams,
    embeddings: Embeddings,
  ): Promise<AzureSearchStore> {
    const client = await this.ensureIndexExists(dbConfig);

    return new this(client, dbConfig, embeddings);
  }
}

/**
 * Prepares the Index
 *
 * @param indexName - the name of the index
 */
function makeSearchIndex(indexName: string): SearchIndex {
  return {
    name: indexName,
    vectorSearch: {
      algorithmConfigurations: [
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
      ]
    },
    semanticSettings: {
      defaultConfiguration: "default",
      configurations: [
        {
          name: "default",
          prioritizedFields: {
            prioritizedContentFields: [{
              name: DEFAULT_FIELD_CONTENT,
            }],
            prioritizedKeywordsFields: [{
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
        vectorSearchConfiguration: "default"
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

function isSearchClient<T extends object>(a: object | SearchClient<T>): a is SearchClient<T> {
    return typeof a === "object" && a !== null && "search" in a;
}
