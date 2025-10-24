import mariadb, { type Pool, type PoolConfig } from "mariadb";
import { VectorStore } from "@langchain/core/vectorstores";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

type Metadata = Record<string, unknown>;

export type DistanceStrategy = "COSINE" | "EUCLIDEAN";

const STANDARD_SIMPLE_OPERATOR = new Map<string, string>([
  ["$eq", "="],
  ["$ne", "!="],
  ["$lt", "<"],
  ["$lte", "<="],
  ["$gt", ">"],
  ["$gte", ">="],
]);

const STANDARD_LIST_OPERATOR = new Map<string, string>([
  ["$in", "in"],
  ["$nin", "not in"],
]);

const STANDARD_BETWEEN_OPERATOR = new Map<string, string>([
  ["$like", "like"],
  ["$nlike", "no like"],
]);

const GROUP_OPERATORS = new Map<string, string>([
  ["$or", "or"],
  ["$and", "and"],
  ["$not", "not"],
]);

const SUPPORTED_OPERATORS = new Map<string, string>([
  ...STANDARD_SIMPLE_OPERATOR,
  ...STANDARD_LIST_OPERATOR,
  ...STANDARD_BETWEEN_OPERATOR,
  ...GROUP_OPERATORS,
]);

/**
 * Interface that defines the arguments required to create a
 * `MariaDBStore` instance. It includes MariaDB connection options,
 * table name and verbosity level.
 */
export interface MariaDBStoreArgs {
  connectionOptions?: PoolConfig;
  pool?: Pool;
  tableName?: string;
  collectionTableName?: string;
  collectionName?: string;
  collectionMetadata?: Metadata | null;
  schemaName?: string | null;
  columns?: {
    idColumnName?: string;
    vectorColumnName?: string;
    contentColumnName?: string;
    metadataColumnName?: string;
  };
  verbose?: boolean;
  /**
   * The amount of documents to chunk by when
   * adding vectors.
   * @default 500
   */
  chunkSize?: number;
  ids?: string[];
  distanceStrategy?: DistanceStrategy;
}

/**
 * MariaDB vector store integration.
 *
 * Setup:
 * Install `@langchain/community` and `mariadb`.
 *
 * If you wish to generate ids, you should also install the `uuid` package.
 *
 * ```bash
 * npm install @langchain/community mariadb uuid
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/_langchain_community.vectorstores_mariadb.MariaDB.html#constructor)
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import {
 *   MariaDBStore,
 *   DistanceStrategy,
 * } from "@langchain/community/vectorstores/mariadb";
 *
 * // Or other embeddings
 * import { OpenAIEmbeddings } from "@langchain/openai";
 * import { PoolConfig } from "mariadb";
 *
 * const embeddings = new OpenAIEmbeddings({
 *   model: "text-embedding-3-small",
 * });
 *
 * // Sample config
 * const config = {
 *   connectionOptions: {
 *     host: "127.0.0.1",
 *     port: 3306,
 *     user: "myuser",
 *     password: "ChangeMe",
 *     database: "api",
 *   } as PoolConfig,
 *   tableName: "testlangchainjs",
 *   columns: {
 *     idColumnName: "id",
 *     vectorColumnName: "vector",
 *     contentColumnName: "content",
 *     metadataColumnName: "metadata",
 *   },
 *   // supported distance strategies: COSINE (default) or EUCLIDEAN
 *   distanceStrategy: "COSINE" as DistanceStrategy,
 * };
 *
 * const vectorStore = await MariaDBStore.initialize(embeddings, config);
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
 * // Output: * thud [{"baz":"bar"}]
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
 * const resultsWithFilter = await vectorStore.similaritySearch("thud", 1, {"country": "BG"});
 *
 * for (const doc of resultsWithFilter) {
 *   console.log(`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
 * }
 * // Output: * foo [{"baz":"bar"}]
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
 * // Output: * [SIM=0.000000] qux [{"bar":"baz","baz":"bar"}]
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
export class MariaDBStore extends VectorStore {
  tableName: string;

  collectionTableName?: string;

  collectionName = "langchain";

  collectionId?: string;

  collectionMetadata: Metadata | null;

  schemaName: string | null;

  idColumnName: string;

  vectorColumnName: string;

  contentColumnName: string;

  metadataColumnName: string;

  _verbose?: boolean;

  pool: Pool;

  chunkSize = 500;

  distanceStrategy: DistanceStrategy;

  constructor(embeddings: EmbeddingsInterface, config: MariaDBStoreArgs) {
    super(embeddings, config);
    this.tableName = this.escapeId(config.tableName ?? "langchain", false);
    if (
      config.collectionName !== undefined &&
      config.collectionTableName === undefined
    ) {
      throw new Error(
        `If supplying a "collectionName", you must also supply a "collectionTableName".`
      );
    }

    this.collectionTableName = config.collectionTableName
      ? this.escapeId(config.collectionTableName, false)
      : undefined;

    this.collectionName = config.collectionName
      ? this.escapeId(config.collectionName, false)
      : "langchaincol";

    this.collectionMetadata = config.collectionMetadata ?? null;
    this.schemaName = config.schemaName
      ? this.escapeId(config.schemaName, false)
      : null;

    this.vectorColumnName = this.escapeId(
      config.columns?.vectorColumnName ?? "embedding",
      false
    );
    this.contentColumnName = this.escapeId(
      config.columns?.contentColumnName ?? "text",
      false
    );
    this.idColumnName = this.escapeId(
      config.columns?.idColumnName ?? "id",
      false
    );
    this.metadataColumnName = this.escapeId(
      config.columns?.metadataColumnName ?? "metadata",
      false
    );

    if (!config.connectionOptions && !config.pool) {
      throw new Error(
        "You must provide either a `connectionOptions` object or a `pool` instance."
      );
    }

    const langchainVerbose = getEnvironmentVariable("LANGCHAIN_VERBOSE");

    if (langchainVerbose === "true") {
      this._verbose = true;
    } else if (langchainVerbose === "false") {
      this._verbose = false;
    } else {
      this._verbose = config.verbose;
    }

    if (config.pool) {
      this.pool = config.pool;
    } else {
      const poolConf = { ...config.connectionOptions, rowsAsArray: true };
      // add query to log if verbose
      if (this._verbose) poolConf.logger = { query: console.log };
      this.pool = mariadb.createPool(poolConf);
    }
    this.chunkSize = config.chunkSize ?? 500;

    this.distanceStrategy =
      config.distanceStrategy ?? ("COSINE" as DistanceStrategy);
  }

  get computedTableName() {
    return this.schemaName == null
      ? this.tableName
      : `${this.schemaName}.${this.tableName}`;
  }

  get computedCollectionTableName() {
    return this.schemaName == null
      ? `${this.collectionTableName}`
      : `"${this.schemaName}"."${this.collectionTableName}"`;
  }

  /**
   * Escape identifier
   *
   * @param identifier identifier value
   * @param alwaysQuote must identifier be quoted if not required
   */
  private escapeId(identifier: string, alwaysQuote: boolean): string {
    if (!identifier || identifier === "")
      throw new Error("Identifier is required");

    const len = identifier.length;
    const simpleIdentifier = /^[0-9a-zA-Z$_]*$/;
    if (simpleIdentifier.test(identifier)) {
      if (len < 1 || len > 64) {
        throw new Error("Invalid identifier length");
      }
      if (alwaysQuote) return `\`${identifier}\``;

      // Identifier names may begin with a numeral, but can't only contain numerals unless quoted.
      if (/^\d+$/.test(identifier)) {
        // identifier containing only numerals must be quoted
        return `\`${identifier}\``;
      }
      // identifier containing only numerals must be quoted
      return identifier;
    } else {
      if (identifier.includes("\u0000")) {
        throw new Error("Invalid name - containing u0000 character");
      }
      let ident = identifier;
      if (/^`.+`$/.test(identifier)) {
        ident = identifier.substring(1, identifier.length - 1);
      }
      if (len < 1 || len > 64) {
        throw new Error("Invalid identifier length");
      }
      return `\`${ident.replace(/`/g, "``")}\``;
    }
  }

  private printable(definition: string): string {
    return definition.replaceAll(/[^0-9a-zA-Z_]/g, "");
  }

  /**
   * Static method to create a new `MariaDBStore` instance from a
   * connection. It creates a table if one does not exist, and calls
   * `connect` to return a new instance of `MariaDBStore`.
   *
   * @param embeddings - Embeddings instance.
   * @param fields - `MariaDBStoreArgs` instance
   * @param fields.dimensions Number of dimensions in your vector data type. default to 1536.
   * @returns A new instance of `MariaDBStore`.
   */
  static async initialize(
    embeddings: EmbeddingsInterface,
    config: MariaDBStoreArgs & { dimensions?: number }
  ): Promise<MariaDBStore> {
    const { dimensions, ...rest } = config;
    const mariadbStore = new MariaDBStore(embeddings, rest);
    await mariadbStore.ensureTableInDatabase(dimensions);
    await mariadbStore.ensureCollectionTableInDatabase();
    await mariadbStore.loadCollectionId();

    return mariadbStore;
  }

  /**
   * Static method to create a new `MariaDBStore` instance from an
   * array of texts and their metadata. It converts the texts into
   * `Document` instances and adds them to the store.
   *
   * @param texts - Array of texts.
   * @param metadatas - Array of metadata objects or a single metadata object.
   * @param embeddings - Embeddings instance.
   * @param dbConfig - `MariaDBStoreArgs` instance.
   * @returns Promise that resolves with a new instance of `MariaDBStore`.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: MariaDBStoreArgs & { dimensions?: number }
  ): Promise<MariaDBStore> {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }

    return MariaDBStore.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Static method to create a new `MariaDBStore` instance from an
   * array of `Document` instances. It adds the documents to the store.
   *
   * @param docs - Array of `Document` instances.
   * @param embeddings - Embeddings instance.
   * @param dbConfig - `MariaDBStoreArgs` instance.
   * @returns Promise that resolves with a new instance of `MariaDBStore`.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: MariaDBStoreArgs & { dimensions?: number }
  ): Promise<MariaDBStore> {
    const instance = await MariaDBStore.initialize(embeddings, dbConfig);
    await instance.addDocuments(docs, { ids: dbConfig.ids });
    return instance;
  }

  _vectorstoreType(): string {
    return "mariadb";
  }

  /**
   * Method to add documents to the vector store. It converts the documents into
   * vectors, and adds them to the store.
   *
   * @param documents - Array of `Document` instances.
   * @param options - Optional arguments for adding documents
   * @returns Promise that resolves when the documents have been added.
   */
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);

    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Inserts a row for the collectionName provided at initialization if it does not
   * exist and set the collectionId.
   */
  private async loadCollectionId(): Promise<void> {
    if (this.collectionId) {
      return;
    }

    if (this.collectionTableName) {
      const queryResult = await this.pool.query(
        {
          sql: `SELECT uuid from ${this.computedCollectionTableName} WHERE label = ?`,
          rowsAsArray: true,
        },
        [this.collectionName]
      );
      if (queryResult.length > 0) {
        this.collectionId = queryResult[0][0];
      } else {
        const insertString = `INSERT INTO ${this.computedCollectionTableName}(label, cmetadata) VALUES (?, ?) RETURNING uuid`;
        const insertResult = await this.pool.query(
          { sql: insertString, rowsAsArray: true },
          [this.collectionName, this.collectionMetadata]
        );
        this.collectionId = insertResult[0][0];
      }
    }
  }

  /**
   * Method to add vectors to the vector store. It converts the vectors into
   * rows and inserts them into the database.
   *
   * @param vectors - Array of vectors.
   * @param documents - Array of `Document` instances.
   * @param options - Optional arguments for adding documents
   * @returns Promise that resolves when the vectors have been added.
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<void> {
    const ids = options?.ids;

    // Either all documents have ids or none of them do to avoid confusion.
    if (ids !== undefined && ids.length !== vectors.length) {
      throw new Error(
        "The number of ids must match the number of vectors provided."
      );
    }
    await this.loadCollectionId();

    const insertQuery = `INSERT INTO ${this.computedTableName}(${
      this.idColumnName
    },${this.contentColumnName},${this.metadataColumnName},${
      this.vectorColumnName
    }${this.collectionId ? ",collection_id" : ""}) VALUES (${
      ids ? "?" : "UUID_v7()"
    }, ?, ?, ?${this.collectionId ? ", ?" : ""})`;

    try {
      const batchParams = [];
      for (let i = 0; i < vectors.length; i += 1) {
        const param = [
          ids ? ids[i] : null,
          documents[i].pageContent,
          documents[i].metadata,
          this.getFloat32Buffer(vectors[i]),
          this.collectionId,
        ];
        if (!ids) param.shift();
        if (!this.collectionId) param.pop();
        batchParams.push(param);
      }
      await this.pool.batch(insertQuery, batchParams);
    } catch (e) {
      console.error(e);
      throw new Error(`Error inserting: ${(e as Error).message}`);
    }
  }

  /**
   * Convert float array to binary value
   * @param vector embedding value
   * @private
   */
  private getFloat32Buffer(vector: number[]) {
    return Buffer.from(new Float32Array(vector).buffer);
  }

  /**
   * Method to delete documents from the vector store. It deletes the
   * documents that match the provided ids
   *
   * @param ids - array of ids
   * @returns Promise that resolves when the documents have been deleted.
   * @example
   * await vectorStore.delete(["id1", "id2"]);
   */
  async delete(params: {
    ids?: string[];
    filter?: Record<string, unknown>;
  }): Promise<void> {
    const { ids, filter } = params;

    if (!(ids || filter)) {
      throw new Error(
        "You must specify either ids or a filter when deleting documents."
      );
    }
    await this.loadCollectionId();

    if (ids) {
      // delete by ids
      await this.pool.query(
        `DELETE FROM ${this.computedTableName} WHERE ${
          this.idColumnName
        } IN (?) ${this.collectionId ? " AND collection_id = ?" : ""}`,
        [ids, this.collectionId]
      );
    } else if (filter) {
      // delete by filter
      const [filterPart, params] = this.filterConverter(filter);
      if (filterPart.length === 0) throw new Error("Wrong filter.");
      await this.pool.query(
        `DELETE FROM ${this.computedTableName} WHERE ${filterPart} ${
          this.collectionId ? " AND collection_id = ?" : ""
        }`,
        [...params, this.collectionId]
      );
    }
  }

  private filterConverter(filter?: Record<string, unknown>): [string, any[]] {
    if (!filter) return ["", []];
    const _filter: Record<string, unknown> = filter ?? {};
    const parameters: any[] = [];
    let sqlFilter = this.subFilterConverter(_filter, parameters, "$and");
    if (sqlFilter.charAt(0) === "(") {
      sqlFilter = sqlFilter.substring(1, sqlFilter.length - 1);
    }
    return [sqlFilter, parameters];
  }

  private subFilterConverter(
    filter: Record<string, unknown>,
    parameters: any[],
    groupOperator: string
  ): string {
    const sqlFilterPart = [];

    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === "object" && value !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const _value: Record<string, any> = value;
        for (const [type, subvalue] of Object.entries(_value)) {
          let realvalue = subvalue;
          if (STANDARD_LIST_OPERATOR.has(type)) {
            if (!Array.isArray(realvalue)) {
              if (
                typeof realvalue !== "string" ||
                typeof realvalue !== "number"
              ) {
                throw new Error(
                  "value for in/not in filter are expected to be an array type"
                );
              }
              realvalue = [realvalue];
            }

            const placeholders = realvalue.map(() => "?").join(",");
            sqlFilterPart.push(
              `JSON_VALUE(${
                this.metadataColumnName
              }, '$.${key}') ${STANDARD_LIST_OPERATOR.get(
                type
              )} (${placeholders})`
            );
            parameters.push(...realvalue);
          } else if (GROUP_OPERATORS.has(type)) {
            sqlFilterPart.push(
              this.subFilterConverter(realvalue, parameters, type)
            );
          } else if (SUPPORTED_OPERATORS.has(type)) {
            sqlFilterPart.push(
              `JSON_VALUE(${
                this.metadataColumnName
              }, '$.${key}') ${SUPPORTED_OPERATORS.get(type)} ?`
            );
            parameters.push(realvalue);
          } else {
            throw new Error(
              `unknown type operation, must be in ${SUPPORTED_OPERATORS.keys()}`
            );
          }
        }
      } else {
        sqlFilterPart.push(
          `JSON_VALUE(${this.metadataColumnName}, '$.${key}') = ?`
        );
        parameters.push(value);
      }
    }
    if (sqlFilterPart.length > 1) {
      return `(${sqlFilterPart.join(
        " " + GROUP_OPERATORS.get(groupOperator) + " "
      )})`;
    } else {
      return sqlFilterPart[0];
    }
  }

  /**
   * Method to perform a similarity search in the vector store. It returns
   * the `k` most similar documents to the query vector, along with their
   * similarity scores.
   *
   * @param query - Query vector.
   * @param k - Number of most similar documents to return.
   * @param filter - Optional filter to apply to the search.
   * @returns Promise that resolves with an array of tuples, each containing a `Document` and its similarity score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: Record<string, unknown>
  ): Promise<[Document, number][]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parameters: unknown[] = [this.getFloat32Buffer(query)];
    const whereClauses = [];

    await this.loadCollectionId();

    if (this.collectionId) {
      whereClauses.push("collection_id = ?");
      parameters.push(this.collectionId);
    }

    if (filter) {
      const [filterPart, params] = this.filterConverter(filter);
      whereClauses.push(filterPart);
      parameters.push(...params);
    }

    // limit
    parameters.push(k);

    const whereClause = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const queryString = `SELECT ${this.idColumnName},${this.contentColumnName},${this.metadataColumnName},VEC_DISTANCE_${this.distanceStrategy}(${this.vectorColumnName}, ?) as distance FROM ${this.computedTableName} ${whereClause} ORDER BY distance ASC LIMIT ?`;

    const documents = await this.pool.execute(
      { sql: queryString, rowsAsArray: true },
      parameters
    );

    const results = [] as [Document, number][];
    for (const doc of documents) {
      if (doc[3] != null && doc[1] != null) {
        const document = new Document({
          id: doc[0],
          pageContent: doc[1],
          metadata: doc[2],
        });
        results.push([document, doc[3]]);
      }
    }
    return results;
  }

  /**
   * Method to ensure the existence of the table in the database. It creates
   * the table if it does not already exist.
   * @param dimensions Number of dimensions in your vector data type. Default to 1536.
   * @returns Promise that resolves when the table has been ensured.
   */
  async ensureTableInDatabase(dimensions = 1536): Promise<void> {
    const tableQuery = `CREATE TABLE IF NOT EXISTS ${this.computedTableName}(${
      this.idColumnName
    } UUID NOT NULL DEFAULT UUID_v7() PRIMARY KEY,${
      this.contentColumnName
    } TEXT,${this.metadataColumnName} JSON,${
      this.vectorColumnName
    } VECTOR(${dimensions}) NOT NULL, VECTOR INDEX ${this.printable(
      this.tableName + "_" + this.vectorColumnName
    )}_idx (${this.vectorColumnName}) ) ENGINE=InnoDB`;
    await this.pool.query(tableQuery);
  }

  /**
   * Method to ensure the existence of the collection table in the database.
   * It creates the table if it does not already exist.
   *
   * @returns Promise that resolves when the collection table has been ensured.
   */
  async ensureCollectionTableInDatabase(): Promise<void> {
    try {
      if (this.collectionTableName != null) {
        await Promise.all([
          this.pool.query(
            `CREATE TABLE IF NOT EXISTS ${
              this.computedCollectionTableName
            }(uuid UUID NOT NULL DEFAULT UUID_v7() PRIMARY KEY,
           label VARCHAR(256), cmetadata JSON, UNIQUE KEY idx_${this.printable(
             this.collectionTableName
           )}_label
           (label))`
          ),
          this.pool.query(
            `ALTER TABLE ${this.computedTableName}
              ADD COLUMN IF NOT EXISTS collection_id uuid,
              ADD CONSTRAINT FOREIGN KEY IF NOT EXISTS ${this.printable(
                this.tableName
              )}_collection_id_fkey (collection_id)
              REFERENCES ${
                this.computedCollectionTableName
              }(uuid) ON DELETE CASCADE`
          ),
        ]);
      }
    } catch (e) {
      console.error(e);
      throw new Error(
        `Error adding column or creating index: ${(e as Error).message}`
      );
    }
  }

  /**
   * Close the pool.
   *
   * @returns Promise that resolves when the pool is terminated.
   */
  async end(): Promise<void> {
    return this.pool.end();
  }
}
