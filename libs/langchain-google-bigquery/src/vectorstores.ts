import { type Table, InsertRowsOptions } from "@google-cloud/bigquery";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";

export type DistanceStrategy = "EUCLIDEAN" | "COSINE" | "DOT_PRODUCT";

/**
 * Type that defines the arguments required to initialize the
 * GoogleBigQueryVectorSearch class. It includes the BigQuery Table instance,
 * text key, embedding key, document key and some vector search options, eg
 * distance type, use brute force and fraction lists
 *
 * @param table Google BigQuery Table instance to store the vectors.
 * @param textKey Corresponds to the plaintext of 'pageContent'.
 * @param embeddingKey Key to store the embedding under.
 * @param documentKey The Key to use for representing the id of document.
 * @param distanceType specifies the type of metric to use to compute the distance between two vectors.
 * @param useBruteForce Determines whether to use brute force search by skipping the vector index if one is available.
 * @param fractionListsToSearch Specifies the percentage of lists to search.
 */
export interface GoogleBigQueryVectorSearchLibArgs {
  readonly table: Table;
  readonly textKey?: string;
  readonly embeddingKey?: string;
  readonly documentKey?: string;
  readonly distanceType?: DistanceStrategy;
  readonly useBruteForce?: boolean;
  readonly fractionListsToSearch?: number;
}

/**
 * Class representing a GoogleBigQueryVectorSearch. It extends the VectorStore class
 * and includes methods for adding documents and vectors, performing
 * similarity searches, insert vectors, and more.
 */
export class GoogleBigQueryVectorSearch extends VectorStore {
  private readonly table: Table;

  private readonly textKey: string;

  private readonly embeddingKey: string;

  private readonly documentKey: string;

  private readonly distanceType: DistanceStrategy;

  private readonly useBruteForce: boolean;

  private readonly fractionListsToSearch?: number;

  constructor(
    embeddings: EmbeddingsInterface,
    args: GoogleBigQueryVectorSearchLibArgs
  ) {
    if (
      args.fractionListsToSearch &&
      (args.fractionListsToSearch < 0 || args.fractionListsToSearch > 1)
    ) {
      throw new Error("fractionListsToSearch must be between 0.0 and 1.0");
    }
    super(embeddings, args);
    this.table = args.table;
    this.documentKey = args.documentKey ?? "_id";
    this.textKey = args.textKey ?? "text";
    this.embeddingKey = args.embeddingKey ?? "embedding";
    this.distanceType = args.distanceType ?? "EUCLIDEAN";
    this.useBruteForce = args.useBruteForce ?? false;
    this.fractionListsToSearch = args.fractionListsToSearch ?? undefined;
  }

  _vectorstoreType(): string {
    return "google_bigquery";
  }

  /**
   * Method to add vectors and their corresponding documents to the BigQuery table
   * @param vectors Vectors to be added.
   * @param documents Corresponding documents to be added.
   * @returns Promise that resolves when the vectors and documents have been added.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: InsertRowsOptions
  ) {
    const docs = vectors.map((embedding, idx) => ({
      [this.textKey]: documents[idx].pageContent,
      [this.embeddingKey]: embedding,
      ...(documents[idx].id ? { [this.documentKey]: documents[idx].id } : {}),
      ...documents[idx].metadata,
    }));

    await this.table.insert(docs, options);
  }

  /**
   * Method for adding documents to the GoogleBigQueryVectorSearch. It first converts
   * the documents to texts and then adds them as vectors.
   * @param documents The documents to add.
   * @param options Optional parameters for adding the documents.
   * @returns A promise that resolves when the documents have been added.
   */
  async addDocuments(documents: Document[], options?: InsertRowsOptions) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method for performing a similarity search in the GoogleBigQueryVectorSearch. It
   * returns the documents and their scores.
   * @param query The query vector.
   * @param k The number of nearest neighbors to return.
   * @param filter Optional filter to apply to the search.
   * @returns A promise that resolves to an array of documents and their scores.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: Record<string, string | number | boolean | Array<number | string>>
  ): Promise<[Document, number][]> {
    let whereClauses = ["TRUE"];
    if (filter && typeof filter === "object") {
      whereClauses = [];
      for (const key in filter) {
        if (Object.hasOwn(filter, key)) {
          let operator = "=";
          let value = filter[key];
          if (typeof value === "string") {
            value = `'${value}'`;
          } else if (Array.isArray(value)) {
            operator = " IN ";
            value = `(${value.join(",")})`;
          }
          whereClauses.push(`base.${key}${operator}${value}`);
        }
      }
    }

    let optionsString = "";
    if (this.useBruteForce) {
      optionsString = ",options => '{\"use_brute_force\":true}'";
    } else if (this.fractionListsToSearch) {
      optionsString = `,options => '{"fraction_lists_to_search":${this.fractionListsToSearch}}'`;
    }

    const sql = `
      SELECT
        base.*, distance AS _vector_search_distance
      FROM VECTOR_SEARCH(
        TABLE ${this.table.dataset.id}.${this.table.id},
        '${this.embeddingKey}',
        (SELECT [${query}] AS ${this.embeddingKey}),
        distance_type => '${this.distanceType}',
        top_k => ${k}${optionsString}
      )
      WHERE ${whereClauses.join(" AND ")}
      LIMIT ${k}
    `;
    const [results] = await this.table.query(sql);
    return results.map<[Document, number]>((result) => {
      const {
        [this.textKey]: pageContent,
        _vector_search_distance: score,
        [this.documentKey]: id,
        ...metadata
      } = result;
      return [new Document({ pageContent, metadata, id }), score];
    });
  }
}
