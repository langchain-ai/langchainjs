import * as uuid from "uuid";
import { Driver, type DriverOptions } from "@ydbjs/core";
import { query as createQueryClient, identifier, type UnsafeString, type QueryClient } from "@ydbjs/query";
import { Uint64 } from "@ydbjs/value/primitive";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

/**
 * KNN search strategy passed to the YDB `Knn::*` UDF.
 *
 * **Similarity strategies** (suffix `Similarity`) return higher values for
 * more similar vectors. Results are sorted **DESC** — the best match is first.
 *
 * **Distance strategies** (suffix `Distance`) return lower values for closer
 * vectors. Results are sorted **ASC** — the best match is first.
 *
 * | Strategy |
 * |---|
 * | `CosineSimilarity` |
 * | `InnerProductSimilarity` |
 * | `CosineDistance` |
 * | `EuclideanDistance` |
 * | `ManhattanDistance` |
 */
export const YDBSearchStrategy = {
  CosineSimilarity: "CosineSimilarity",
  InnerProductSimilarity: "InnerProductSimilarity",
  CosineDistance: "CosineDistance",
  ManhattanDistance: "ManhattanDistance",
  EuclideanDistance: "EuclideanDistance",
} as const;

export type YDBSearchStrategyType =
  (typeof YDBSearchStrategy)[keyof typeof YDBSearchStrategy];

/**
 * Mapping from logical field names to physical column names in the YDB table.
 * Override any field via `columnMap` in the store config when the table
 * schema uses non-default names.
 */
export interface YDBColumnMap {
  /** Primary key column — stores the document ID. Default: `"id"`. */
  id: string;
  /** Column that holds the document text (`Utf8`). Default: `"document"`. */
  document: string;
  /** Column that holds the packed `Float32` embedding bytes (`String`). Default: `"embedding"`. */
  embedding: string;
  /** Column that holds arbitrary document metadata as JSON. Default: `"metadata"`. */
  metadata: string;
}

/** Common options, independent of how the driver is provided. */
export interface YDBVectorStoreBaseConfig {
  /** YDB table name. Defaults to `"langchain_vectors"`. */
  table?: string;
  /**
   * Override individual column names when the table was not created by this
   * store (e.g. you have an existing schema). Only the fields you specify are
   * overridden — omitted fields keep their defaults.
   */
  columnMap?: Partial<YDBColumnMap>;
  /**
   * Vector similarity/distance function used in KNN search.
   * Defaults to `YDBSearchStrategy.CosineSimilarity`.
   * See {@link YDBSearchStrategy} for the full list and sort-order semantics.
   */
  strategy?: YDBSearchStrategyType;
  /**
   * When `true`, the table is dropped and recreated on the first operation.
   * Useful during development or testing. Defaults to `false`.
   */
  dropExistingTable?: boolean;
  /**
   * Number of dimensions in the embedding vectors.
   * When omitted the store embeds a short probe string on first use to detect
   * the dimension automatically — set this to avoid the extra round-trip.
   */
  vectorDimension?: number;
  /**
   * Enable the `vector_kmeans_tree` approximate nearest-neighbour index.
   * When `true`, call {@link YDBVectorStore.createVectorIndex} after inserting
   * the initial batch of documents.
   * Defaults to `false` (exact scan).
   */
  indexEnabled?: boolean;
  /** Name of the vector index. Defaults to `"langchain_vector_index"`. */
  indexName?: string;
  /**
   * Number of tree levels in the k-means index. Valid range: 1–3.
   * Higher values improve recall at the cost of slower index build time.
   * Defaults to `2`.
   */
  indexConfigLevels?: number;
  /**
   * Number of k-means clusters per tree level. Valid range: 64–512.
   * Larger values yield finer partitions and better recall, but require
   * more memory and a longer build. Defaults to `128`.
   */
  indexConfigClusters?: number;
  /**
   * `KMeansTreeSearchTopSize` PRAGMA value — how many leaf clusters are
   * visited during an indexed search. Higher values improve recall at the
   * cost of latency. Defaults to `1`.
   */
  indexTreeSearchTopSize?: number;
}

/**
 * Pass either a pre-built Driver (you manage its lifecycle) or a connection
 * string (the store creates and owns the Driver; call `store.close()` when done).
 */
export type YDBVectorStoreConfig = YDBVectorStoreBaseConfig &
  (
    | {
        /** A ready-to-use Driver instance from `@ydbjs/core`. */
        driver: Driver;
        connectionString?: never;
        driverOptions?: never;
      }
    | {
        /**
         * YDB connection string, e.g. `"grpc://localhost:2136/local"`.
         * The store creates a Driver internally; call `store.close()` to release it.
         */
        connectionString: string;
        /** Additional Driver options (auth, TLS, …). */
        driverOptions?: DriverOptions;
        driver?: never;
      }
  );

/**
 * Metadata filter for similarity search.
 *
 * Each key-value pair is translated to a
 * `JSON_VALUE(metadata, '$.key') = 'value'` condition.
 * Multiple entries are combined with `AND`.
 *
 * **Limitations:**
 * - Values must be strings (JSON scalars are compared as text).
 * - Cannot be used together with `indexEnabled: true` — the vector index
 *   does not support pre-filtering.
 */
export type YDBFilter = Record<string, string>;

function vectorToBytes(vector: number[]): Uint8Array {
  const float32 = new Float32Array(vector);
  const floatBytes = new Uint8Array(float32.buffer);
  const result = new Uint8Array(floatBytes.length + 1);
  result.set(floatBytes);
  result[floatBytes.length] = 0x01;
  return result;
}

/**
 * Escapes a string value for use inside a YQL JSON path literal (e.g. `'$.key'`).
 * JSON path keys cannot be passed as bound parameters in YQL, so escaping is
 * the only option here. This function is intentionally NOT used for regular
 * string values — those must be passed as bound query parameters instead.
 */
function escJsonPathKey(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * LangChain vector store backed by YDB.
 *
 * Uses `@ydbjs/core` (Driver) and `@ydbjs/query` (tagged-template YQL
 * client) — both must be installed as peer dependencies.
 *
 * Embeddings are stored as packed little-endian `Float32` bytes in a
 * `String` column and searched with the built-in `Knn::*` UDFs.
 *
 * @example Using a connection string (store manages the Driver):
 * ```typescript
 * import { YDBVectorStore } from "@langchain/community/vectorstores/ydb";
 * import { OpenAIEmbeddings } from "@langchain/openai";
 *
 * const store = new YDBVectorStore(new OpenAIEmbeddings(), {
 *   connectionString: "grpc://localhost:2136/local",
 * });
 * await store.addDocuments([
 *   { pageContent: "LangChain supports YDB", metadata: { source: "docs" } },
 * ]);
 * const results = await store.similaritySearch("YDB", 4);
 * store.close();
 * ```
 *
 * @example Using a pre-built Driver (caller manages its lifecycle):
 * ```typescript
 * import { Driver } from "@ydbjs/core";
 * import { YDBVectorStore } from "@langchain/community/vectorstores/ydb";
 * import { OpenAIEmbeddings } from "@langchain/openai";
 *
 * const driver = new Driver("grpc://localhost:2136/local");
 * await driver.ready();
 * const store = new YDBVectorStore(new OpenAIEmbeddings(), { driver });
 * await store.addDocuments([
 *   { pageContent: "LangChain supports YDB", metadata: { source: "docs" } },
 * ]);
 * const results = await store.similaritySearch("YDB", 4);
 * await driver.close();
 * ```
 */
export class YDBVectorStore extends VectorStore {
  declare FilterType: YDBFilter;

  private driver: Driver;

  private ownedDriver: boolean;

  private sql: QueryClient;

  private table: string;

  private columnMap: YDBColumnMap;

  private strategy: YDBSearchStrategyType;

  private sortOrder: "ASC" | "DESC";

  private dropExistingTable: boolean;

  private vectorDimension?: number;

  private indexEnabled: boolean;

  private indexName: string;

  private indexConfigLevels: number;

  private indexConfigClusters: number;

  private indexTreeSearchTopSize: number;

  private isInitialized = false;

  _vectorstoreType(): string {
    return "ydb";
  }

  constructor(embeddings: EmbeddingsInterface, config: YDBVectorStoreConfig) {
    super(embeddings, config);

    if ("connectionString" in config && config.connectionString) {
      this.driver = new Driver(config.connectionString, config.driverOptions);
      this.ownedDriver = true;
    } else {
      this.driver = (config as { driver: Driver }).driver;
      this.ownedDriver = false;
    }

    this.sql = createQueryClient(this.driver);
    this.table = config.table ?? "langchain_vectors";
    this.columnMap = {
      id: "id",
      document: "document",
      embedding: "embedding",
      metadata: "metadata",
      ...config.columnMap,
    };
    this.strategy = config.strategy ?? YDBSearchStrategy.CosineSimilarity;
    this.sortOrder = this.strategy.endsWith("Similarity") ? "DESC" : "ASC";
    this.dropExistingTable = config.dropExistingTable ?? false;
    this.vectorDimension = config.vectorDimension;
    this.indexEnabled = config.indexEnabled ?? false;
    this.indexName = config.indexName ?? "langchain_vector_index";
    this.indexConfigLevels = config.indexConfigLevels ?? 2;
    this.indexConfigClusters = config.indexConfigClusters ?? 128;
    this.indexTreeSearchTopSize = config.indexTreeSearchTopSize ?? 1;
  }

  private get t(): UnsafeString {
    return identifier(this.table);
  }

  private async ensureTable(): Promise<void> {
    await this.driver.ready();
    if (this.isInitialized) return;

    const { id, document: doc, embedding: emb, metadata: meta } =
      this.columnMap;

    if (this.dropExistingTable) {
      await this.sql`DROP TABLE IF EXISTS ${this.t}`;
    }

    await this.sql`
      CREATE TABLE IF NOT EXISTS ${this.t} (
        ${identifier(id)}   Utf8,
        ${identifier(doc)}  Utf8,
        ${identifier(emb)}  String,
        ${identifier(meta)} Json,
        PRIMARY KEY (${identifier(id)})
      )`;

    this.isInitialized = true;
  }

  private getIndexStrategy(): string {
    switch (this.strategy) {
      case YDBSearchStrategy.CosineSimilarity:
        return "similarity=cosine";
      case YDBSearchStrategy.InnerProductSimilarity:
        return "similarity=inner_product";
      case YDBSearchStrategy.CosineDistance:
        return "distance=cosine";
      case YDBSearchStrategy.EuclideanDistance:
        return "distance=euclidean";
      case YDBSearchStrategy.ManhattanDistance:
        return "distance=manhattan";
      default:
        throw new Error(`Unsupported search strategy: ${String(this.strategy)}`);
    }
  }

  /**
   * Insert or replace documents using pre-computed embedding vectors.
   *
   * Uses `UPSERT` semantics: if a document with the same ID already exists it
   * is overwritten, not duplicated.  Documents without an explicit `id` receive
   * a random UUID.
   *
   * @param vectors - Embedding vectors, one per document (same order).
   * @param documents - Documents to store.
   * @returns The ID of every inserted/updated document (same order as input).
   */
  async addVectors(
    vectors: number[][],
    documents: Document[]
  ): Promise<string[]> {
    if (vectors.length === 0) return [];
    await this.ensureTable();

    const { id, document: doc, embedding: emb, metadata: meta } =
      this.columnMap;
    const cols = [id, doc, emb, meta].map(identifier).join(", ");

    const ids: string[] = [];
    const batchSize = 32;

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize).map((d, j) => {
        const docId = d.id ?? uuid.v4();
        ids.push(docId);
        return {
          id: docId,
          document: d.pageContent,
          embedding: vectorToBytes(vectors[i + j]),
          metadata: JSON.stringify(d.metadata ?? {}),
        };
      });

      // AS_TABLE binds the array as List<Struct>; CAST converts the
      // metadata string (Utf8) to Json for the target column.
      await this.sql`
        UPSERT INTO ${this.t} (${this.sql.unsafe(cols)})
        SELECT id, document, embedding, CAST(metadata AS Json)
        FROM AS_TABLE(${batch})`;
    }

    return ids;
  }

  /**
   * Embed and store documents.
   *
   * Embeds each document's `pageContent` with the configured embeddings model,
   * then delegates to {@link addVectors}.  Uses `UPSERT` semantics.
   *
   * @param documents - Documents to embed and store.
   * @returns The ID of every inserted/updated document (same order as input).
   */
  async addDocuments(documents: Document[]): Promise<string[]> {
    const texts = documents.map((d) => d.pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    return this.addVectors(vectors, documents);
  }

  /**
   * Find the `k` documents most similar to a pre-computed query vector.
   *
   * @param query - The query embedding vector.
   * @param k - Maximum number of results to return.
   * @param filter - Optional metadata filter (see {@link YDBFilter}).
   *   Cannot be combined with `indexEnabled: true`.
   * @returns Pairs of `[document, score]` sorted by the configured strategy:
   *   descending for similarity strategies, ascending for distance strategies.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    await this.ensureTable();

    const { id, document: doc, embedding: emb, metadata: meta } =
      this.columnMap;

    if (filter && Object.keys(filter).length > 0 && this.indexEnabled) {
      throw new Error("Cannot use metadata filter with vector index enabled.");
    }

    let pragmaClause = "";
    let viewClause = "";
    if (this.indexEnabled) {
      pragmaClause = `PRAGMA ydb.KMeansTreeSearchTopSize="${this.indexTreeSearchTopSize}"; `;
      viewClause = `VIEW ${identifier(this.indexName)}`;
    }

    const embeddingBytes = vectorToBytes(query);
    const filterEntries = Object.entries(filter ?? {});

    // Build the query dynamically so that the embedding bytes, every filter
    // value, AND the LIMIT are passed as bound parameters (not interpolated
    // into SQL text). Stable query text across different k values means YDB
    // can reuse its compiled query plan.
    //
    // JSON path keys (e.g. `$.key`) cannot be parameterised in YQL and are
    // escaped with escJsonPathKey instead.
    //
    // This uses the standard tagged-template calling convention:
    //   sql`a ${v1} b ${v2} c`  ≡  sql(["a ", " b ", " c"], v1, v2)
    const sqlParts: string[] = [];
    const boundValues: unknown[] = [embeddingBytes]; // becomes $p0

    sqlParts.push(
      `${pragmaClause}SELECT ` +
        `${identifier(id)} AS id, ` +
        `${identifier(doc)} AS document, ` +
        `${identifier(meta)} AS metadata, ` +
        `Knn::${this.strategy}(${identifier(emb)}, `
      // $p0 (embeddingBytes) is appended next by the template engine
    );

    const afterEmb = `) AS score FROM ${this.t} ${viewClause}`;

    if (filterEntries.length > 0) {
      const [firstKey, firstValue] = filterEntries[0];
      sqlParts.push(
        `${afterEmb} WHERE JSON_VALUE(${identifier(meta)}, '$.${escJsonPathKey(firstKey)}') = `
        // $p1 appended next
      );
      boundValues.push(firstValue);

      for (let i = 1; i < filterEntries.length; i++) {
        const [key, value] = filterEntries[i];
        sqlParts.push(
          ` AND JSON_VALUE(${identifier(meta)}, '$.${escJsonPathKey(key)}') = `
          // $p{i+1} appended next
        );
        boundValues.push(value);
      }
      sqlParts.push(` ORDER BY score ${this.sortOrder} LIMIT `);
    } else {
      sqlParts.push(`${afterEmb} ORDER BY score ${this.sortOrder} LIMIT `);
    }
    // LIMIT as a Uint64 bound parameter — query text stays stable for any k value.
    boundValues.push(new Uint64(BigInt(Math.floor(k))));
    sqlParts.push("");

    const tpl = Object.freeze(
      Object.assign(sqlParts, { raw: sqlParts })
    ) as unknown as TemplateStringsArray;

    const resultSets = await this.sql(tpl, ...boundValues);

    // resultSets is an array of result sets; the first one holds our rows.
    const rows = (
      resultSets as Array<Array<Record<string, unknown>>>
    )[0] ?? [];

    return rows.map((row) => [
      new Document({
        pageContent: String(row.document),
        metadata:
          typeof row.metadata === "string"
            ? JSON.parse(row.metadata)
            : (row.metadata as Record<string, unknown>) ?? {},
        id: String(row.id),
      }),
      Number(row.score),
    ]);
  }

  /**
   * Delete documents from the store.
   *
   * @param params.ids - Delete only the documents with these IDs.
   * @param params.deleteAll - When `true`, truncate the entire table.
   *   Takes precedence over `ids`.
   */
  async delete(params: {
    ids?: string[];
    deleteAll?: boolean;
  }): Promise<void> {
    await this.driver.ready();
    if (params.deleteAll) {
      await this.sql`DELETE FROM ${this.t}`;
    } else if (params.ids && params.ids.length > 0) {
      // Pass the ID list as a bound List<Utf8> parameter — YQL supports
      // `WHERE col IN $list_param` directly, no subquery needed.
      const col = identifier(this.columnMap.id);
      await this.sql`DELETE FROM ${this.t} WHERE ${col} IN ${params.ids}`;
    }
  }

  /**
   * Drop the backing YDB table (`DROP TABLE IF EXISTS`).
   * All data is permanently deleted. The store can be reused after this call —
   * the table will be recreated on the next write.
   */
  async drop(): Promise<void> {
    await this.driver.ready();
    await this.sql`DROP TABLE IF EXISTS ${this.t}`;
    this.isInitialized = false;
  }

  /**
   * Build a `vector_kmeans_tree` approximate nearest-neighbour index on the
   * embedding column.
   *
   * **When to call:** after inserting the initial batch of documents and before
   * the store goes into production.  Documents added after index creation are
   * still searchable — YDB scans them without the index, then merges results.
   *
   * **Trade-off:** the index enables sub-linear search at the cost of recall.
   * Tune `indexConfigLevels`, `indexConfigClusters`, and
   * `indexTreeSearchTopSize` to balance speed vs. accuracy.
   *
   * Requires `indexEnabled: true` in the store config.
   * Throws if the index already exists (re-building requires dropping first).
   */
  async createVectorIndex(): Promise<void> {
    if (!this.indexEnabled) {
      throw new Error(
        "Cannot create vector index: indexEnabled is false in config."
      );
    }
    await this.driver.ready();

    const dim =
      this.vectorDimension ??
      (await this.embeddings.embedQuery("test")).length;

    await this.sql`
      ALTER TABLE ${this.t}
      ADD INDEX ${identifier(this.indexName)}
      GLOBAL USING vector_kmeans_tree
      ON (${identifier(this.columnMap.embedding)})
      WITH (
        ${this.sql.unsafe(this.getIndexStrategy())},
        vector_type="Float",
        vector_dimension=${this.sql.unsafe(String(dim))},
        levels=${this.sql.unsafe(String(this.indexConfigLevels))},
        clusters=${this.sql.unsafe(String(this.indexConfigClusters))}
      )`;
  }

  /**
   * Close the internally-created Driver.
   * No-op when an external `driver` was provided — the caller owns its lifecycle.
   */
  close(): void {
    if (this.ownedDriver) {
      this.driver.close();
    }
  }

  /**
   * Create a store, embed the provided texts, and insert them in one step.
   *
   * @param texts - Raw text strings to embed and store.
   * @param metadatas - A single metadata object (applied to all texts) or one
   *   object per text.
   * @param embeddings - Embeddings model used to vectorise the texts.
   * @param config - Store configuration (connection + table options).
   * @returns A ready-to-use store containing the inserted documents.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object | object[],
    embeddings: EmbeddingsInterface,
    config: YDBVectorStoreConfig
  ): Promise<YDBVectorStore> {
    const docs = texts.map(
      (text, i) =>
        new Document({
          pageContent: text,
          metadata: Array.isArray(metadatas) ? metadatas[i] : metadatas,
        })
    );
    return YDBVectorStore.fromDocuments(docs, embeddings, config);
  }

  /**
   * Create a store, embed the provided documents, and insert them in one step.
   *
   * @param docs - Documents to embed and store.
   * @param embeddings - Embeddings model used to vectorise the document text.
   * @param config - Store configuration (connection + table options).
   * @returns A ready-to-use store containing the inserted documents.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    config: YDBVectorStoreConfig
  ): Promise<YDBVectorStore> {
    const store = new YDBVectorStore(embeddings, config);
    await store.addDocuments(docs);
    return store;
  }

  /**
   * Connect to an existing YDB table without running `CREATE TABLE`.
   *
   * Use this when the table was created by a previous store instance or by
   * external tooling and you want to search or insert without re-initialising
   * the schema. The column names and vector strategy must match those used
   * when the table was first created.
   *
   * @param embeddings - Embeddings model (must produce the same dimension as
   *   the stored vectors).
   * @param config - Store configuration. Omit `dropExistingTable` — it has no
   *   effect here since `CREATE TABLE` is never called.
   * @returns A store instance whose table-creation step is already marked done.
   */
  static fromExistingTable(
    embeddings: EmbeddingsInterface,
    config: YDBVectorStoreConfig
  ): YDBVectorStore {
    const store = new YDBVectorStore(embeddings, config);
    store.isInitialized = true;
    return store;
  }
}
