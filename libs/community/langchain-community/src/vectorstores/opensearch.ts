import { Client, RequestParams, errors } from "@opensearch-project/opensearch";
import * as uuid from "uuid";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

type OpenSearchEngine = "nmslib" | "hnsw";
type OpenSearchSpaceType = "l2" | "cosinesimil" | "ip";

/**
 * Interface defining the options for vector search in OpenSearch. It
 * includes the engine type, space type, and parameters for the HNSW
 * algorithm.
 */
interface VectorSearchOptions {
  readonly engine?: OpenSearchEngine;
  readonly spaceType?: OpenSearchSpaceType;
  readonly m?: number;
  readonly efConstruction?: number;
  readonly efSearch?: number;
  readonly numberOfShards?: number;
  readonly numberOfReplicas?: number;
}

/**
 * Interface defining the arguments required to create an instance of the
 * OpenSearchVectorStore class. It includes the OpenSearch client, index
 * name, and vector search options.
 */
export interface OpenSearchClientArgs {
  readonly client: Client;
  readonly vectorFieldName?: string;
  readonly textFieldName?: string;
  readonly metadataFieldName?: string;
  readonly service?: "es" | "aoss";
  readonly indexName?: string;

  readonly vectorSearchOptions?: VectorSearchOptions;
}

/**
 * Type alias for an object. It's used to define filters for OpenSearch
 * queries.
 */
type OpenSearchFilter = {
  [key: string]: FilterTypeValue | (string | number)[] | string | number;
};

/**
 * FilterTypeValue for OpenSearch queries.
 */
interface FilterTypeValue {
  exists?: boolean;
  fuzzy?: string;
  ids?: string[];
  prefix?: string;
  gte?: number;
  gt?: number;
  lte?: number;
  lt?: number;
  regexp?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  terms_set?: Record<string, any>;
  wildcard?: string;
}

/**
 * Class that provides a wrapper around the OpenSearch service for vector
 * search. It provides methods for adding documents and vectors to the
 * OpenSearch index, searching for similar vectors, and managing the
 * OpenSearch index.
 */
export class OpenSearchVectorStore extends VectorStore {
  declare FilterType: OpenSearchFilter;

  private readonly client: Client;

  private readonly indexName: string;

  // if true, use the Amazon OpenSearch Serverless service instead of es
  private readonly isAoss: boolean;

  private readonly engine: OpenSearchEngine;

  private readonly spaceType: OpenSearchSpaceType;

  private readonly efConstruction: number;

  private readonly efSearch: number;

  private readonly numberOfShards: number;

  private readonly numberOfReplicas: number;

  private readonly m: number;

  private readonly vectorFieldName: string;

  private readonly textFieldName: string;

  private readonly metadataFieldName: string;

  _vectorstoreType(): string {
    return "opensearch";
  }

  constructor(embeddings: EmbeddingsInterface, args: OpenSearchClientArgs) {
    super(embeddings, args);

    this.spaceType = args.vectorSearchOptions?.spaceType ?? "l2";
    this.engine = args.vectorSearchOptions?.engine ?? "nmslib";
    this.m = args.vectorSearchOptions?.m ?? 16;
    this.efConstruction = args.vectorSearchOptions?.efConstruction ?? 512;
    this.efSearch = args.vectorSearchOptions?.efSearch ?? 512;
    this.numberOfShards = args.vectorSearchOptions?.numberOfShards ?? 5;
    this.numberOfReplicas = args.vectorSearchOptions?.numberOfReplicas ?? 1;
    this.vectorFieldName = args.vectorFieldName ?? "embedding";
    this.textFieldName = args.textFieldName ?? "text";
    this.metadataFieldName = args.metadataFieldName ?? "metadata";

    this.client = args.client;
    this.indexName = args.indexName ?? "documents";
    this.isAoss = (args.service ?? "es") === "aoss";
  }

  /**
   * Method to add documents to the OpenSearch index. It first converts the
   * documents to vectors using the embeddings, then adds the vectors to the
   * index.
   * @param documents The documents to be added to the OpenSearch index.
   * @returns Promise resolving to void.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Method to add vectors to the OpenSearch index. It ensures the index
   * exists, then adds the vectors and associated documents to the index.
   * @param vectors The vectors to be added to the OpenSearch index.
   * @param documents The documents associated with the vectors.
   * @param options Optional parameter that can contain the IDs for the documents.
   * @returns Promise resolving to void.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<void> {
    await this.ensureIndexExists(
      vectors[0].length,
      this.engine,
      this.spaceType,
      this.efSearch,
      this.efConstruction,
      this.numberOfShards,
      this.numberOfReplicas,
      this.m
    );
    const documentIds =
      options?.ids ?? Array.from({ length: vectors.length }, () => uuid.v4());
    const operations = vectors.flatMap((embedding, idx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const document: Record<string, any> = [
        {
          index: {
            _index: this.indexName,
            _id: documentIds[idx],
          },
        },
        {
          [this.vectorFieldName]: embedding,
          [this.textFieldName]: documents[idx].pageContent,
          [this.metadataFieldName]: documents[idx].metadata,
        },
      ];

      // aoss does not support document id
      if (this.isAoss) {
        delete document[0].index?._id;
      }

      return document;
    });
    await this.client.bulk({ body: operations });

    // aoss does not support refresh
    if (!this.isAoss) {
      await this.client.indices.refresh({ index: this.indexName });
    }
  }

  /**
   * Method to perform a similarity search on the OpenSearch index using a
   * query vector. It returns the k most similar documents and their scores.
   * @param query The query vector.
   * @param k The number of similar documents to return.
   * @param filter Optional filter for the OpenSearch query.
   * @returns Promise resolving to an array of tuples, each containing a Document and its score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: OpenSearchFilter | undefined
  ): Promise<[Document, number][]> {
    const search: RequestParams.Search = {
      index: this.indexName,
      body: {
        query: {
          bool: {
            filter: { bool: this.buildMetadataTerms(filter) },
            must: [
              {
                knn: {
                  [this.vectorFieldName]: { vector: query, k },
                },
              },
            ],
          },
        },
        size: k,
      },
    };

    const { body } = await this.client.search(search);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return body.hits.hits.map((hit: any) => [
      new Document({
        pageContent: hit._source[this.textFieldName],
        metadata: hit._source[this.metadataFieldName],
        id: hit._id,
      }),
      hit._score,
    ]);
  }

  /**
   * Static method to create a new OpenSearchVectorStore from an array of
   * texts, their metadata, embeddings, and OpenSearch client arguments.
   * @param texts The texts to be converted into documents and added to the OpenSearch index.
   * @param metadatas The metadata associated with the texts. Can be an array of objects or a single object.
   * @param embeddings The embeddings used to convert the texts into vectors.
   * @param args The OpenSearch client arguments.
   * @returns Promise resolving to a new instance of OpenSearchVectorStore.
   */
  static fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    args: OpenSearchClientArgs
  ): Promise<OpenSearchVectorStore> {
    const documents = texts.map((text, idx) => {
      const metadata = Array.isArray(metadatas) ? metadatas[idx] : metadatas;
      return new Document({ pageContent: text, metadata });
    });

    return OpenSearchVectorStore.fromDocuments(documents, embeddings, args);
  }

  /**
   * Static method to create a new OpenSearchVectorStore from an array of
   * Documents, embeddings, and OpenSearch client arguments.
   * @param docs The documents to be added to the OpenSearch index.
   * @param embeddings The embeddings used to convert the documents into vectors.
   * @param dbConfig The OpenSearch client arguments.
   * @returns Promise resolving to a new instance of OpenSearchVectorStore.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: OpenSearchClientArgs
  ): Promise<OpenSearchVectorStore> {
    const store = new OpenSearchVectorStore(embeddings, dbConfig);
    await store.addDocuments(docs).then(() => store);
    return store;
  }

  /**
   * Static method to create a new OpenSearchVectorStore from an existing
   * OpenSearch index, embeddings, and OpenSearch client arguments.
   * @param embeddings The embeddings used to convert the documents into vectors.
   * @param dbConfig The OpenSearch client arguments.
   * @returns Promise resolving to a new instance of OpenSearchVectorStore.
   */
  static async fromExistingIndex(
    embeddings: EmbeddingsInterface,
    dbConfig: OpenSearchClientArgs
  ): Promise<OpenSearchVectorStore> {
    const store = new OpenSearchVectorStore(embeddings, dbConfig);
    await store.client.cat.indices({ index: store.indexName });
    return store;
  }

  private async ensureIndexExists(
    dimension: number,
    engine = "nmslib",
    spaceType = "l2",
    efSearch = 512,
    efConstruction = 512,
    numberOfShards = 5,
    numberOfReplicas = 1,
    m = 16
  ): Promise<void> {
    const body = {
      settings: {
        index: {
          number_of_shards: numberOfShards,
          number_of_replicas: numberOfReplicas,
          knn: true,
          "knn.algo_param.ef_search": efSearch,
        },
      },
      mappings: {
        dynamic_templates: [
          {
            // map all metadata properties to be keyword
            [`${this.metadataFieldName}.*`]: {
              match_mapping_type: "string",
              mapping: { type: "keyword" },
            },
          },
          {
            [`${this.metadataFieldName}.loc`]: {
              match_mapping_type: "object",
              mapping: { type: "object" },
            },
          },
        ],
        properties: {
          [this.textFieldName]: { type: "text" },
          [this.metadataFieldName]: { type: "object" },
          [this.vectorFieldName]: {
            type: "knn_vector",
            dimension,
            method: {
              name: "hnsw",
              engine,
              space_type: spaceType,
              parameters: { ef_construction: efConstruction, m },
            },
          },
        },
      },
    };

    const indexExists = await this.doesIndexExist();
    if (indexExists) return;

    await this.client.indices.create({ index: this.indexName, body });
  }

  /**
   * Builds metadata terms for OpenSearch queries.
   *
   * This function takes a filter object and constructs an array of query terms
   * compatible with OpenSearch 2.x. It supports a variety of query types including
   * term, terms, terms_set, ids, range, prefix, exists, fuzzy, wildcard, and regexp.
   * Reference: https://opensearch.org/docs/latest/query-dsl/term/index/
   *
   * @param {Filter | null} filter - The filter object used to construct query terms.
   * Each key represents a field, and the value specifies the type of query and its parameters.
   *
   * @returns {Array<Record<string, any>>} An array of OpenSearch query terms.
   *
   * @example
   * // Example filter:
   * const filter = {
   *   status: { "exists": true },
   *   age: { "gte": 30, "lte": 40 },
   *   tags: ["tag1", "tag2"],
   *   description: { "wildcard": "*test*" },
   *
   * };
   *
   * // Resulting query terms:
   * const queryTerms = buildMetadataTerms(filter);
   * // queryTerms would be an array of OpenSearch query objects.
   */
  buildMetadataTerms(filter: OpenSearchFilter | undefined): object {
    if (!filter) return {};
    const must = [];
    const must_not = [];
    for (const [key, value] of Object.entries(filter)) {
      const metadataKey = `${this.metadataFieldName}.${key}`;
      if (value) {
        if (typeof value === "object" && !Array.isArray(value)) {
          if ("exists" in value) {
            if (value.exists) {
              must.push({ exists: { field: metadataKey } });
            } else {
              must_not.push({ exists: { field: metadataKey } });
            }
          } else if ("fuzzy" in value) {
            must.push({ fuzzy: { [metadataKey]: value.fuzzy } });
          } else if ("ids" in value) {
            must.push({ ids: { values: value.ids } });
          } else if ("prefix" in value) {
            must.push({ prefix: { [metadataKey]: value.prefix } });
          } else if (
            "gte" in value ||
            "gt" in value ||
            "lte" in value ||
            "lt" in value
          ) {
            must.push({ range: { [metadataKey]: value } });
          } else if ("regexp" in value) {
            must.push({ regexp: { [metadataKey]: value.regexp } });
          } else if ("terms_set" in value) {
            must.push({ terms_set: { [metadataKey]: value.terms_set } });
          } else if ("wildcard" in value) {
            must.push({ wildcard: { [metadataKey]: value.wildcard } });
          }
        } else {
          const aggregatorKey = Array.isArray(value) ? "terms" : "term";
          must.push({ [aggregatorKey]: { [metadataKey]: value } });
        }
      }
    }
    return { must, must_not };
  }

  /**
   * Method to check if the OpenSearch index exists.
   * @returns Promise resolving to a boolean indicating whether the index exists.
   */
  async doesIndexExist(): Promise<boolean> {
    try {
      await this.client.cat.indices({ index: this.indexName });
      return true;
    } catch (err: unknown) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (err instanceof errors.ResponseError && err.statusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Method to delete the OpenSearch index if it exists.
   * @returns Promise resolving to void.
   */
  async deleteIfExists(): Promise<void> {
    const indexExists = await this.doesIndexExist();
    if (!indexExists) return;

    await this.client.indices.delete({ index: this.indexName });
  }
}
