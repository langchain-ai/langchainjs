import { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { v4 as uuidv4 } from "uuid";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import {
  BaseIndex,
  DEFAULT_DISTANCE_STRATEGY,
  DEFAULT_INDEX_NAME_SUFFIX,
  DistanceStrategy,
  QueryOptions,
} from "./indexes.js";
import PostgresEngine from "./engine.js";
import { customZip } from "./utils/utils.js";

export interface PostgresVectorStoreArgs {
  schemaName?: string;
  contentColumn?: string;
  embeddingColumn?: string;
  metadataColumns?: Array<string>;
  idColumn?: string;
  distanceStrategy?: DistanceStrategy;
  k?: number;
  fetchK?: number;
  lambdaMult?: number;
  ignoreMetadataColumns?: Array<string>;
  metadataJsonColumn?: string;
  indexQueryOptions?: QueryOptions;
}

export interface dbConfigArgs {
  engine: PostgresEngine;
  tableName: string;
  dbConfig?: PostgresVectorStoreArgs;
}

interface VSArgs {
  engine: PostgresEngine;
  tableName: string;
  schemaName: string;
  contentColumn: string;
  embeddingColumn: string;
  metadataColumns: Array<string>;
  idColumn: string;
  distanceStrategy: DistanceStrategy;
  k: number;
  fetchK: number;
  lambdaMult: number;
  metadataJsonColumn: string;
  indexQueryOptions?: QueryOptions;
}

/**
 * Google Cloud SQL for PostgreSQL vector store integration.
 *
 * Setup:
 * Install `@langchain/google-cloud-sql-pg`
 *
 * ```bash
 * npm install @langchain/google-cloud-sql-pg
 * ```
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { Column, PostgresEngine, PostgresEngineArgs, PostgresVectorStore, VectorStoreTableArgs } from "@langchain/google-cloud-sql-pg";
 * // Or other embeddings
 * import { OpenAIEmbeddings } from '@langchain/openai';
 *
 *
 * const embeddings = new OpenAIEmbeddings({
 *   model: "text-embedding-3-small",
 * });
 *
 * const pgArgs: PostgresEngineArgs = {
 *     user: "db-user",
 *     password: "password"
 * }
 * // Create a shared connection pool
 * const engine: PostgresEngine = await PostgresEngine.fromInstance(
 *  "project-id",
 *  "region",
 *  "instance-name",
 *  "database-name",
 *  pgArgs
 * );
 * // (Optional) Specify metadata columns for filtering
 * // All other metadata will be added to JSON
 * const vectorStoreTableArgs: VectorStoreTableArgs = {
 *   metadataColumns: [new Column("baz", "TEXT")],
 * };
 * // Create a vector store table
 * await engine.initVectorstoreTable("my-table", 768, vectorStoreTableArgs);
 * // Customize the vector store
 * const pvectorArgs: PostgresVectorStoreArgs = {
 *     idColumn: "ID_COLUMN",
 *     contentColumn: "CONTENT_COLUMN",
 *     embeddingColumn: "EMBEDDING_COLUMN",
 *     metadataColumns: ["baz"]
 * }
 *
 * const vectorStore = await PostgresVectorStore.initialize(engine, embeddingService, "my-table", pvectorArgs);
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Add documents</strong></summary>
 *
 * ```typescript
 * import type { Document } from '@langchain/core/documents';
 *
 * const document1 = { pageContent: "foo", metadata: { baz: "bar" } };
 * const document2 = { pageContent: "thud", metadata: { bar: "baz" } };
 * const document3 = { pageContent: "i will be deleted :(", metadata: {} };
 *
 * const documents: Document[] = [document1, document2, document3];
 * const ids = ["1", "2", "3"];
 * await vectorStore.addDocuments(documents, { ids });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Delete documents</strong></summary>
 *
 * ```typescript
 * await vectorStore.delete({ ids: ["3"] });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Similarity search</strong></summary>
 *
 * ```typescript
 * const results = await vectorStore.similaritySearch("thud", 1);
 * for (const doc of results) {
 *   console.log(`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
 * }
 * // Output:thud [{"baz":"bar"}]
 * ```
 * </details>
 *
 * <br />
 *
 *
 * <details>
 * <summary><strong>Similarity search with filter</strong></summary>
 *
 * ```typescript
 * const resultsWithFilter = await vectorStore.similaritySearch("thud", 1, { baz: "bar" });
 *
 * for (const doc of resultsWithFilter) {
 *   console.log(`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
 * }
 * // Output:foo [{"baz":"bar"}]
 * ```
 * </details>
 *
 * <br />
 *
 *
 * <details>
 * <summary><strong>Similarity search with score</strong></summary>
 *
 * ```typescript
 * const resultsWithScore = await vectorStore.similaritySearchWithScore("qux", 1);
 * for (const [doc, score] of resultsWithScore) {
 *   console.log(`* [SIM=${score.toFixed(6)}] ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
 * }
 * // Output:[SIM=0.000000] qux [{"bar":"baz","baz":"bar"}]
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>As a retriever</strong></summary>
 *
 * ```typescript
 * const retriever = vectorStore.asRetriever({
 *   searchType: "mmr", // Leave blank for standard similarity search
 *   k: 1,
 * });
 * const resultAsRetriever = await retriever.invoke("thud");
 * console.log(resultAsRetriever);
 *
 * // Output: [Document({ metadata: { "baz":"bar" }, pageContent: "thud" })]
 * ```
 * </details>
 *
 * <br />
 */
export class PostgresVectorStore extends VectorStore {
  declare FilterType: Record<string, string>;

  engine: PostgresEngine;

  embeddings: EmbeddingsInterface;

  tableName: string;

  schemaName: string;

  contentColumn: string;

  embeddingColumn: string;

  metadataColumns: Array<string>;

  idColumn: string;

  metadataJsonColumn: string;

  distanceStrategy: DistanceStrategy;

  k: number;

  fetchK: number;

  lambdaMult: number;

  indexQueryOptions: QueryOptions | undefined;

  /**
   * Initializes a new vector store with embeddings and database configuration.
   *
   * @param embeddings - Instance of `EmbeddingsInterface` used to embed queries.
   * @param dbConfig - Configuration settings for the database or storage system.
   */
  constructor(embeddings: EmbeddingsInterface, dbConfig: VSArgs) {
    super(embeddings, dbConfig);
    this.embeddings = embeddings;
    this.engine = dbConfig.engine;
    this.tableName = dbConfig.tableName;
    this.schemaName = dbConfig.schemaName;
    this.contentColumn = dbConfig.contentColumn;
    this.embeddingColumn = dbConfig.embeddingColumn;
    this.metadataColumns = dbConfig.metadataColumns
      ? dbConfig.metadataColumns
      : [];
    this.idColumn = dbConfig.idColumn;
    this.metadataJsonColumn = dbConfig.metadataJsonColumn;
    this.distanceStrategy = dbConfig.distanceStrategy;
    this.k = dbConfig.k;
    this.fetchK = dbConfig.fetchK;
    this.lambdaMult = dbConfig.lambdaMult;
    this.indexQueryOptions = dbConfig.indexQueryOptions;
  }

  /**
   * Create a new PostgresVectorStore instance.
   * @param {PostgresEngine} engine Required - Connection pool engine for managing connections to Cloud SQL for PostgreSQL database.
   * @param {Embeddings} embeddings Required - Text embedding model to use.
   * @param {string} tableName Required - Name of an existing table or table to be created.
   * @param {string} schemaName Database schema name of the table. Defaults to "public".
   * @param {string} contentColumn Column that represent a Document's page_content. Defaults to "content".
   * @param {string} embeddingColumn Column for embedding vectors. The embedding is generated from the document value. Defaults to "embedding".
   * @param {Array<string>} metadataColumns Column(s) that represent a document's metadata.
   * @param {Array<string>} ignoreMetadataColumns Optional - Column(s) to ignore in pre-existing tables for a document's metadata. Can not be used with metadata_columns.
   * @param {string} idColumn Column that represents the Document's id. Defaults to "langchain_id".
   * @param {string} metadataJsonColumn Optional - Column to store metadata as JSON. Defaults to "langchain_metadata".
   * @param {DistanceStrategy} distanceStrategy Distance strategy to use for vector similarity search. Defaults to COSINE_DISTANCE.
   * @param {number} k Number of Documents to return from search. Defaults to 4.
   * @param {number} fetchK Number of Documents to fetch to pass to MMR algorithm.
   * @param {number} lambdaMult Number between 0 and 1 that determines the degree of diversity among the results with 0 corresponding to maximum diversity and 1 to minimum diversity. Defaults to 0.5.
   * @param {QueryOptions} indexQueryOptions Optional - Index query option.
   * @returns PostgresVectorStore instance.
   */
  static async initialize(
    engine: PostgresEngine,
    embeddings: EmbeddingsInterface,
    tableName: string,
    {
      schemaName = "public",
      contentColumn = "content",
      embeddingColumn = "embedding",
      metadataColumns = [],
      ignoreMetadataColumns,
      idColumn = "langchain_id",
      metadataJsonColumn = "langchain_metadata",
      distanceStrategy = DEFAULT_DISTANCE_STRATEGY,
      k = 4,
      fetchK = 20,
      lambdaMult = 0.5,
      indexQueryOptions,
    }: PostgresVectorStoreArgs = {}
  ): Promise<PostgresVectorStore> {
    if (metadataColumns !== undefined && ignoreMetadataColumns !== undefined) {
      throw Error(
        "Can not use both metadata_columns and ignore_metadata_columns."
      );
    }

    const { rows } = await engine.pool.raw(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = '${schemaName}'`
    );
    const columns: { [key: string]: string } = {};

    for (const index in rows) {
      if (rows[index]) {
        const row = rows[index];
        columns[row.column_name] = row.data_type;
      }
    }

    if (!Object.prototype.hasOwnProperty.call(columns, idColumn)) {
      throw Error(`Id column: ${idColumn}, does not exist.`);
    }

    if (!Object.prototype.hasOwnProperty.call(columns, contentColumn)) {
      throw Error(`Content column: ${contentColumn}, does not exist.`);
    }

    const contentType = columns[contentColumn];

    if (contentType !== "text" && !contentType.includes("char")) {
      throw Error(
        `Content column: ${contentColumn}, is type: ${contentType}. It must be a type of character string.`
      );
    }

    if (!Object.prototype.hasOwnProperty.call(columns, embeddingColumn)) {
      throw Error(`Embedding column: ${embeddingColumn}, does not exist.`);
    }

    if (columns[embeddingColumn] !== "USER-DEFINED") {
      throw Error(
        `Embedding column: ${embeddingColumn} is not of type Vector.`
      );
    }

    const jsonColumn = Object.prototype.hasOwnProperty.call(
      columns,
      metadataJsonColumn
    )
      ? metadataJsonColumn
      : "";

    for (const column of metadataColumns) {
      if (!Object.prototype.hasOwnProperty.call(columns, column)) {
        throw Error(`Metadata column: ${column}, does not exist.`);
      }
    }

    const allColumns = columns;
    let allMetadataColumns: string[] = [];
    if (
      ignoreMetadataColumns !== undefined &&
      ignoreMetadataColumns.length > 0
    ) {
      for (const column of ignoreMetadataColumns) {
        delete allColumns[column];
      }

      delete allColumns[idColumn];
      delete allColumns[contentColumn];
      delete allColumns[embeddingColumn];
      allMetadataColumns = Object.keys(allColumns);
    } else {
      for (const column of metadataColumns) {
        if (Object.prototype.hasOwnProperty.call(allColumns, column)) {
          allMetadataColumns.push(column);
        }
      }
    }
    return new PostgresVectorStore(embeddings, {
      engine,
      tableName,
      schemaName,
      contentColumn,
      embeddingColumn,
      metadataColumns: allMetadataColumns,
      idColumn,
      metadataJsonColumn: jsonColumn,
      distanceStrategy,
      k,
      fetchK,
      lambdaMult,
      indexQueryOptions,
    });
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: dbConfigArgs
  ): Promise<VectorStore> {
    const documents: Document[] = [];

    for (let i = 0; i < texts.length; i += 1) {
      const doc = new Document({
        pageContent: texts[i],
        metadata: Array.isArray(metadatas) ? metadatas[i] : metadatas,
      });
      documents.push(doc);
    }

    return PostgresVectorStore.fromDocuments(documents, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: dbConfigArgs
  ): Promise<VectorStore> {
    const { engine } = dbConfig;
    const { tableName } = dbConfig;
    const config = dbConfig.dbConfig;
    const vectorStore = await this.initialize(
      engine,
      embeddings,
      tableName,
      config
    );

    await vectorStore.addDocuments(docs);

    return vectorStore;
  }

  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<string[] | void> {
    let ids: string[] = [];
    const metadatas: Record<string, string>[] = [];

    if (vectors.length !== documents.length) {
      throw new Error(
        "The number of vectors must match the number of documents provided."
      );
    }

    if (options?.ids) {
      ids = options.ids;
    } else {
      documents.forEach((document) => {
        if (document.id !== undefined) {
          ids.push(document.id);
        } else {
          ids.push(uuidv4());
        }
      });
    }

    if (options && options.ids && options.ids.length !== documents.length) {
      throw new Error(
        "The number of ids must match the number of documents provided."
      );
    }

    documents.forEach((document) => {
      metadatas.push(document.metadata);
    });

    const tuples = customZip(ids, documents, vectors, metadatas);

    // Insert embeddings
    for (const [id, document, embedding, metadata] of tuples) {
      const metadataColNames =
        this.metadataColumns.length > 0
          ? `, "${this.metadataColumns.join('","')}"`
          : "";

      let stmt = `INSERT INTO "${this.schemaName}"."${this.tableName}"("${this.idColumn}", "${this.contentColumn}", "${this.embeddingColumn}" ${metadataColNames}`;
      const values: { [key: string]: string | string[] } = {
        id,
        content: document.pageContent,
        embedding: `[${embedding.toString()}]`,
      };
      let valuesStmt = " VALUES (:id, :content, :embedding";

      // Add metadata
      const extra = metadata;
      for (const metadataColumn of this.metadataColumns) {
        if (Object.prototype.hasOwnProperty.call(metadata, metadataColumn)) {
          valuesStmt += `, :${metadataColumn}`;
          values[metadataColumn] = metadata[metadataColumn];
          delete extra[metadataColumn];
        } else {
          valuesStmt += " ,null";
        }
      }

      // Add JSON column and/or close statement
      stmt += this.metadataJsonColumn ? `, ${this.metadataJsonColumn})` : ")";
      if (this.metadataJsonColumn) {
        valuesStmt += ", :extra)";
        Object.assign(values, { extra: JSON.stringify(extra) });
      } else {
        valuesStmt += ")";
      }

      const query = stmt + valuesStmt;
      await this.engine.pool.raw(query, values);
    }

    return options?.ids;
  }

  _vectorstoreType(): string {
    return "cloudsqlpostgresql";
  }

  /**
   * Adds documents to the vector store, embedding them first through the
   * `embeddings` instance.
   *
   * @param documents - Array of documents to embed and add.
   * @param options - Optional configuration for embedding and storing documents.
   * @returns A promise resolving to an array of document IDs or void, based on implementation.
   * @abstract
   */
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<string[] | void> {
    const texts = [];

    for (const doc of documents) {
      texts.push(doc.pageContent);
    }

    const embeddings = await this.embeddings.embedDocuments(texts);
    const results = await this.addVectors(embeddings, documents, options);

    return results;
  }

  /**
   * Deletes documents from the vector store based on the specified ids.
   *
   * @param params - Flexible key-value pairs defining conditions for document deletion.
   * @param ids -  Optional: Property of {params} that contains the array of ids to be deleted
   * @returns A promise that resolves once the deletion is complete.
   */
  async delete(params: { ids?: string[] }): Promise<void> {
    if (params.ids === undefined) return;
    const idList = params.ids.map((id) => `'${id}'`).join(", ");
    const query = `DELETE FROM "${this.schemaName}"."${this.tableName}" WHERE "${this.idColumn}" in (${idList})`;
    await this.engine.pool.raw(query);
  }

  async similaritySearchVectorWithScore(
    embedding: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    const results = await this.queryCollection(embedding, k, filter);
    const documentsWithScores: [Document, number][] = [];

    for (const row of results) {
      const metadata =
        this.metadataJsonColumn && row[this.metadataJsonColumn]
          ? row[this.metadataJsonColumn]
          : {};

      for (const col of this.metadataColumns) {
        metadata[col] = row[col];
      }

      documentsWithScores.push([
        new Document({ pageContent: row[this.contentColumn], metadata }),
        row.distance,
      ]);
    }

    return documentsWithScores;
  }

  private async queryCollection(
    embedding: number[],
    k?: number | undefined,
    filter?: this["FilterType"] | undefined
  ) {
    const fetchK = k ?? this.k;
    const { operator } = this.distanceStrategy;
    const { searchFunction } = this.distanceStrategy;
    const filterColumns = filter !== undefined ? Object.keys(filter) : [];
    const filterBindings: Record<string, string> = {};
    let _filter = "";
    if (filterColumns.length > 0) {
      const conditions = filterColumns.map((col, i) => {
        const bindingKey = `filter_${i}`;
        filterBindings[bindingKey] = filter[col];
        return `"${col.replace(/"/g, '""')}" = :${bindingKey}`;
      });
      _filter = `WHERE ${conditions.join(" AND ")}`;
    }
    const metadataColNames =
      this.metadataColumns.length > 0
        ? `, "${this.metadataColumns.join('","')}"`
        : "";
    const metadataJsonColName = this.metadataJsonColumn
      ? `, "${this.metadataJsonColumn}"`
      : "";

    const query = `SELECT "${this.idColumn}", "${this.contentColumn}", "${this.embeddingColumn}" ${metadataColNames} ${metadataJsonColName}, ${searchFunction}("${this.embeddingColumn}", '[${embedding}]') as distance FROM "${this.schemaName}"."${this.tableName}" ${_filter} ORDER BY "${this.embeddingColumn}" ${operator} '[${embedding}]' LIMIT ${fetchK};`;

    if (this.indexQueryOptions) {
      await this.engine.pool.raw(
        `SET LOCAL ${this.indexQueryOptions.to_string()}`
      );
    }

    const { rows } = await this.engine.pool.raw(query, filterBindings);

    return rows;
  }

  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    const vector = await this.embeddings.embedQuery(query);
    const results = await this.queryCollection(
      vector,
      options?.k,
      options?.filter
    );
    const k = options?.k ? options.k : this.k;
    const documentsWithScores: [Document, number][] = [];
    let docsList: Document[] = [];

    const embeddingList = results.map((row: { [x: string]: string }) =>
      JSON.parse(row[this.embeddingColumn])
    );
    const mmrSelected = maximalMarginalRelevance(
      vector,
      embeddingList,
      options?.lambda,
      k
    );

    for (const row of results) {
      const metadata =
        this.metadataJsonColumn && row[this.metadataJsonColumn]
          ? row[this.metadataJsonColumn]
          : {};
      for (const col of this.metadataColumns) {
        metadata[col] = row[col];
      }
      documentsWithScores.push([
        new Document({
          pageContent: row[this.contentColumn],
          metadata,
        }),
        row.distance,
      ]);
    }

    docsList = documentsWithScores
      .filter((_, i) => mmrSelected.includes(i))
      .map(([doc, _]) => doc);

    return docsList;
  }

  /**
   * Create an index on the vector store table
   * @param {BaseIndex} index
   * @param {string} name Optional
   * @param {boolean} concurrently Optional
   */
  async applyVectorIndex(
    index: BaseIndex,
    name?: string,
    concurrently: boolean = false
  ): Promise<void> {
    if (index.constructor.name === "ExactNearestNeighbor") {
      await this.dropVectorIndex();
      return;
    }

    const filter =
      index.partialIndexes && index.partialIndexes?.length > 0
        ? `WHERE (${index.partialIndexes})`
        : "";
    const params = `WITH ${index.indexOptions()}`;
    const funct = index.distanceStrategy.indexFunction;

    let indexName = name;
    if (!indexName) {
      if (!index.name) {
        indexName = this.tableName + DEFAULT_INDEX_NAME_SUFFIX;
      } else {
        indexName = index.name;
      }
    }

    const stmt = `CREATE INDEX ${
      concurrently ? "CONCURRENTLY" : ""
    } ${indexName} ON "${this.schemaName}"."${this.tableName}" USING ${
      index.indexType
    } (${this.embeddingColumn} ${funct}) ${params} ${filter};`;

    await this.engine.pool.raw(stmt);
  }

  /**
   * Check if index exists in the table.
   * @param {string} indexName Optional - index name
   */
  async isValidIndex(indexName?: string): Promise<boolean> {
    const idxName = indexName || this.tableName + DEFAULT_INDEX_NAME_SUFFIX;
    const stmt = `SELECT tablename, indexname
                  FROM pg_indexes
                  WHERE tablename = '${this.tableName}' AND schemaname = '${this.schemaName}' AND indexname = '${idxName}';`;
    const { rows } = await this.engine.pool.raw(stmt);

    return rows.length === 1;
  }

  /**
   * Drop the vector index
   * @param {string} indexName Optional - index name
   */
  async dropVectorIndex(indexName?: string): Promise<void> {
    const idxName = indexName || this.tableName + DEFAULT_INDEX_NAME_SUFFIX;
    const query = `DROP INDEX IF EXISTS ${idxName};`;
    await this.engine.pool.raw(query);
  }

  /**
   * Re-index the vector store table
   * @param {string} indexName Optional - index name
   */
  async reIndex(indexName?: string) {
    const idxName = indexName || this.tableName + DEFAULT_INDEX_NAME_SUFFIX;
    const query = `REINDEX INDEX ${idxName};`;
    await this.engine.pool.raw(query);
  }
}

export default PostgresVectorStore;
