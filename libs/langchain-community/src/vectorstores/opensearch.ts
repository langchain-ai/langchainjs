import { Client, RequestParams, errors } from "@opensearch-project/opensearch";
import * as uuid from "uuid";
import { Embeddings } from "@langchain/core/embeddings";
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
}

/**
 * Interface defining the arguments required to create an instance of the
 * OpenSearchVectorStore class. It includes the OpenSearch client, index
 * name, and vector search options.
 */
export interface OpenSearchClientArgs {
  readonly client: Client;
  readonly indexName?: string;

  readonly vectorSearchOptions?: VectorSearchOptions;
}

/**
 * Type alias for an object. It's used to define filters for OpenSearch
 * queries.
 */
type OpenSearchFilter = object;

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

  private readonly engine: OpenSearchEngine;

  private readonly spaceType: OpenSearchSpaceType;

  private readonly efConstruction: number;

  private readonly efSearch: number;

  private readonly m: number;

  _vectorstoreType(): string {
    return "opensearch";
  }

  constructor(embeddings: Embeddings, args: OpenSearchClientArgs) {
    super(embeddings, args);

    this.spaceType = args.vectorSearchOptions?.spaceType ?? "l2";
    this.engine = args.vectorSearchOptions?.engine ?? "nmslib";
    this.m = args.vectorSearchOptions?.m ?? 16;
    this.efConstruction = args.vectorSearchOptions?.efConstruction ?? 512;
    this.efSearch = args.vectorSearchOptions?.efSearch ?? 512;

    this.client = args.client;
    this.indexName = args.indexName ?? "documents";
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
      this.m
    );
    const documentIds =
      options?.ids ?? Array.from({ length: vectors.length }, () => uuid.v4());
    const operations = vectors.flatMap((embedding, idx) => [
      {
        index: {
          _index: this.indexName,
          _id: documentIds[idx],
        },
      },
      {
        embedding,
        metadata: documents[idx].metadata,
        text: documents[idx].pageContent,
      },
    ]);
    await this.client.bulk({ body: operations });
    await this.client.indices.refresh({ index: this.indexName });
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
            filter: { bool: { must: this.buildMetadataTerms(filter) } },
            must: [
              {
                knn: {
                  embedding: { vector: query, k },
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
        pageContent: hit._source.text,
        metadata: hit._source.metadata,
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
    embeddings: Embeddings,
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
    embeddings: Embeddings,
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
    embeddings: Embeddings,
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
    m = 16
  ): Promise<void> {
    const body = {
      settings: {
        index: {
          number_of_shards: 5,
          number_of_replicas: 1,
          knn: true,
          "knn.algo_param.ef_search": efSearch,
        },
      },
      mappings: {
        dynamic_templates: [
          {
            // map all metadata properties to be keyword
            "metadata.*": {
              match_mapping_type: "*",
              mapping: { type: "keyword" },
            },
          },
        ],
        properties: {
          text: { type: "text" },
          metadata: { type: "object" },
          embedding: {
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

  private buildMetadataTerms(
    filter?: OpenSearchFilter
  ): { [key: string]: Record<string, unknown> }[] {
    if (filter == null) return [];
    const result = [];
    for (const [key, value] of Object.entries(filter)) {
      const aggregatorKey = Array.isArray(value) ? "terms" : "term";
      result.push({ [aggregatorKey]: { [`metadata.${key}`]: value } });
    }
    return result;
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
