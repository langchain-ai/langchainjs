import * as uuid from "uuid";
import { Client, estypes } from "@elastic/elasticsearch";
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
/**
 * Type representing the k-nearest neighbors (k-NN) engine used in
 * Elasticsearch.
 */
type ElasticKnnEngine = "hnsw";
/**
 * Type representing the similarity measure used in Elasticsearch.
 */
type ElasticSimilarity = "l2_norm" | "dot_product" | "cosine";

/**
 * Interface defining the options for vector search in Elasticsearch.
 */
interface VectorSearchOptions {
  readonly engine?: ElasticKnnEngine;
  readonly similarity?: ElasticSimilarity;
  readonly m?: number;
  readonly efConstruction?: number;
  readonly candidates?: number;
}

/**
 * Interface defining the arguments required to create an Elasticsearch
 * client.
 */
export interface ElasticClientArgs {
  readonly client: Client;
  readonly indexName?: string;
  readonly vectorSearchOptions?: VectorSearchOptions;
}

/**
 * Type representing a filter object in Elasticsearch.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElasticFilter = object | { field: string; operator: string; value: any }[];

/**
 * Class for interacting with an Elasticsearch database. It extends the
 * VectorStore base class and provides methods for adding documents and
 * vectors to the Elasticsearch database, performing similarity searches,
 * deleting documents, and more.
 */
export class ElasticVectorSearch extends VectorStore {
  declare FilterType: ElasticFilter;

  private readonly client: Client;

  private readonly indexName: string;

  private readonly engine: ElasticKnnEngine;

  private readonly similarity: ElasticSimilarity;

  private readonly efConstruction: number;

  private readonly m: number;

  private readonly candidates: number;

  _vectorstoreType(): string {
    return "elasticsearch";
  }

  constructor(embeddings: Embeddings, args: ElasticClientArgs) {
    super(embeddings, args);

    this.engine = args.vectorSearchOptions?.engine ?? "hnsw";
    this.similarity = args.vectorSearchOptions?.similarity ?? "l2_norm";
    this.m = args.vectorSearchOptions?.m ?? 16;
    this.efConstruction = args.vectorSearchOptions?.efConstruction ?? 100;
    this.candidates = args.vectorSearchOptions?.candidates ?? 200;

    this.client = args.client.child({
      headers: { "user-agent": "langchain-js-vs/0.0.1" },
    });
    this.indexName = args.indexName ?? "documents";
  }

  /**
   * Method to add documents to the Elasticsearch database. It first
   * converts the documents to vectors using the embeddings, then adds the
   * vectors to the database.
   * @param documents The documents to add to the database.
   * @param options Optional parameter that can contain the IDs for the documents.
   * @returns A promise that resolves with the IDs of the added documents.
   */
  async addDocuments(documents: Document[], options?: { ids?: string[] }) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method to add vectors to the Elasticsearch database. It ensures the
   * index exists, then adds the vectors and their corresponding documents
   * to the database.
   * @param vectors The vectors to add to the database.
   * @param documents The documents corresponding to the vectors.
   * @param options Optional parameter that can contain the IDs for the documents.
   * @returns A promise that resolves with the IDs of the added documents.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ) {
    await this.ensureIndexExists(
      vectors[0].length,
      this.engine,
      this.similarity,
      this.efConstruction,
      this.m
    );
    const documentIds =
      options?.ids ?? Array.from({ length: vectors.length }, () => uuid.v4());
    const operations = vectors.flatMap((embedding, idx) => [
      {
        index: {
          _id: documentIds[idx],
          _index: this.indexName,
        },
      },
      {
        embedding,
        metadata: documents[idx].metadata,
        text: documents[idx].pageContent,
      },
    ]);
    const results = await this.client.bulk({ refresh: true, operations });
    if (results.errors) {
      const reasons = results.items.map(
        (result) => result.index?.error?.reason
      );
      throw new Error(`Failed to insert documents:\n${reasons.join("\n")}`);
    }
    return documentIds;
  }

  /**
   * Method to perform a similarity search in the Elasticsearch database
   * using a vector. It returns the k most similar documents along with
   * their similarity scores.
   * @param query The query vector.
   * @param k The number of most similar documents to return.
   * @param filter Optional filter to apply to the search.
   * @returns A promise that resolves with an array of tuples, where each tuple contains a Document and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: ElasticFilter
  ): Promise<[Document, number][]> {
    const result = await this.client.search({
      index: this.indexName,
      size: k,
      knn: {
        field: "embedding",
        query_vector: query,
        filter: this.buildMetadataTerms(filter),
        k,
        num_candidates: this.candidates,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.hits.hits.map((hit: any) => [
      new Document({
        pageContent: hit._source.text,
        metadata: hit._source.metadata,
      }),
      hit._score,
    ]);
  }

  /**
   * Method to delete documents from the Elasticsearch database.
   * @param params Object containing the IDs of the documents to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async delete(params: { ids: string[] }): Promise<void> {
    const operations = params.ids.map((id) => ({
      delete: {
        _id: id,
        _index: this.indexName,
      },
    }));
    await this.client.bulk({ refresh: true, operations });
  }

  /**
   * Static method to create an ElasticVectorSearch instance from texts. It
   * creates Document instances from the texts and their corresponding
   * metadata, then calls the fromDocuments method to create the
   * ElasticVectorSearch instance.
   * @param texts The texts to create the ElasticVectorSearch instance from.
   * @param metadatas The metadata corresponding to the texts.
   * @param embeddings The embeddings to use for the documents.
   * @param args The arguments to create the Elasticsearch client.
   * @returns A promise that resolves with the created ElasticVectorSearch instance.
   */
  static fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    args: ElasticClientArgs
  ): Promise<ElasticVectorSearch> {
    const documents = texts.map((text, idx) => {
      const metadata = Array.isArray(metadatas) ? metadatas[idx] : metadatas;
      return new Document({ pageContent: text, metadata });
    });

    return ElasticVectorSearch.fromDocuments(documents, embeddings, args);
  }

  /**
   * Static method to create an ElasticVectorSearch instance from Document
   * instances. It adds the documents to the Elasticsearch database, then
   * returns the ElasticVectorSearch instance.
   * @param docs The Document instances to create the ElasticVectorSearch instance from.
   * @param embeddings The embeddings to use for the documents.
   * @param dbConfig The configuration for the Elasticsearch database.
   * @returns A promise that resolves with the created ElasticVectorSearch instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: ElasticClientArgs
  ): Promise<ElasticVectorSearch> {
    const store = new ElasticVectorSearch(embeddings, dbConfig);
    await store.addDocuments(docs).then(() => store);
    return store;
  }

  /**
   * Static method to create an ElasticVectorSearch instance from an
   * existing index in the Elasticsearch database. It checks if the index
   * exists, then returns the ElasticVectorSearch instance if it does.
   * @param embeddings The embeddings to use for the documents.
   * @param dbConfig The configuration for the Elasticsearch database.
   * @returns A promise that resolves with the created ElasticVectorSearch instance if the index exists, otherwise it throws an error.
   */
  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: ElasticClientArgs
  ): Promise<ElasticVectorSearch> {
    const store = new ElasticVectorSearch(embeddings, dbConfig);
    const exists = await store.doesIndexExist();
    if (exists) {
      return store;
    }
    throw new Error(`The index ${store.indexName} does not exist.`);
  }

  private async ensureIndexExists(
    dimension: number,
    engine = "hnsw",
    similarity = "l2_norm",
    efConstruction = 100,
    m = 16
  ): Promise<void> {
    const request: estypes.IndicesCreateRequest = {
      index: this.indexName,
      mappings: {
        dynamic_templates: [
          {
            // map all metadata properties to be keyword except loc
            metadata_except_loc: {
              match_mapping_type: "*",
              match: "metadata.*",
              unmatch: "metadata.loc",
              mapping: { type: "keyword" },
            },
          },
        ],
        properties: {
          text: { type: "text" },
          metadata: {
            type: "object",
            properties: {
              loc: { type: "object" }, // explicitly define loc as an object
            },
          },
          embedding: {
            type: "dense_vector",
            dims: dimension,
            index: true,
            similarity,
            index_options: {
              type: engine,
              m,
              ef_construction: efConstruction,
            },
          },
        },
      },
    };

    const indexExists = await this.doesIndexExist();
    if (indexExists) return;

    await this.client.indices.create(request);
  }

  private buildMetadataTerms(
    filter?: ElasticFilter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): { [operator: string]: { [field: string]: any } }[] {
    if (filter == null) return [];
    const result = [];
    const filters = Array.isArray(filter)
      ? filter
      : Object.entries(filter).map(([key, value]) => ({
          operator: "term",
          field: key,
          value,
        }));
    for (const condition of filters) {
      result.push({
        [condition.operator]: {
          [`metadata.${condition.field}`]: condition.value,
        },
      });
    }
    return result;
  }

  /**
   * Method to check if an index exists in the Elasticsearch database.
   * @returns A promise that resolves with a boolean indicating whether the index exists.
   */
  async doesIndexExist(): Promise<boolean> {
    return await this.client.indices.exists({ index: this.indexName });
  }

  /**
   * Method to delete an index from the Elasticsearch database if it exists.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deleteIfExists(): Promise<void> {
    const indexExists = await this.doesIndexExist();
    if (!indexExists) return;

    await this.client.indices.delete({ index: this.indexName });
  }
}
