/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-explicit-any */
import oracledb from "oracledb";
import { createHash } from "crypto";
import {
  type MaxMarginalRelevanceSearchOptions,
  VectorStore,
} from "@langchain/core/vectorstores";
import { Document, type DocumentInterface } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";

type Metadata = Record<string, unknown>;

export interface OracleDBVSStoreArgs {
  tableName: string;
  schemaName?: string | null;
  client: oracledb.Pool | oracledb.Connection;
  query: string; // compulsory?
  distanceStrategy?: DistanceStrategy;
  filter?: Metadata;
}

export const DistanceStrategy = {
  COSINE: "COSINE",
  DOT_PRODUCT: "DOT",
  EUCLIDEAN: "EUCLIDEAN",
  MANHATTAN: "MANHATTAN",
  HAMMING: "HAMMING",
  EUCLIDEAN_SQUARED: "EUCLIDEAN_SQUARED",
} as const;

export type DistanceStrategy =
  (typeof DistanceStrategy)[keyof typeof DistanceStrategy];

type AddDocumentOptions = Record<string, any>;

function handleError(error: unknown): never {
  // Type guard to check if the error is an object and has 'name' and 'message' properties
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    "message" in error
  ) {
    const err = error as { name: string; message: string }; // Type assertion based on guarded checks

    // Handle specific error types based on the name property
    switch (err.name) {
      case "RuntimeError":
        throw new Error("Database operation failed due to a runtime error.");
      case "ValidationError":
        throw new Error("Operation failed due to a validation error.");
      default:
        throw new Error(
          `An unexpected error occurred during the operation. ${error}`
        );
    }
  }
  throw new Error(`An unknown and unexpected error occurred. ${error}`);
}

function isPool(
  client: oracledb.Connection | oracledb.Pool
): client is oracledb.Pool {
  return "getConnection" in client;
}

function quoteIdentifier(identifier: string) {
  const name = identifier.trim();

  const validateRegex = /^(?:"[^"]+"|[^".]+)(?:\.(?:"[^"]+"|[^".]+))*$/;
  if (!validateRegex.test(name)) {
    throw new Error(`Identifier name ${identifier} is not valid.`);
  }

  // extracts parts of the identifier with quoted and unquoted.
  const matchRegex = /"([^"]+)"|([^".]+)/g;
  const groups = [];

  for (const match of name.matchAll(matchRegex)) {
    groups.push(match[1] || match[2]);
  }
  const quotedParts = groups.map((g) => `"${g}"`);
  return quotedParts.join(".");
}

export async function createTable(
  connection: oracledb.Connection,
  tableName: string,
  embeddingDim: number
): Promise<void> {
  const colsDict = {
    id: "RAW(16) DEFAULT SYS_GUID() PRIMARY KEY",
    embedding: `vector(${embeddingDim}, FLOAT32)`,
    text: "CLOB",
    metadata: "JSON",
  };

  try {
    const ddlBody = Object.entries(colsDict)
      .map(([colName, colType]) => `${colName} ${colType}`)
      .join(", ");
    const ddl = `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)}
                   (
                       ${ddlBody}
                   )`;
    await connection.execute(ddl);
  } catch (error: unknown) {
    handleError(error);
  }
}

function _getIndexName(baseName: string): string {
  const uniqueId = crypto.randomUUID().replace(/-/g, "");
  return `${baseName}_${uniqueId}`;
}

export async function createIndex(
  client: oracledb.Connection,
  vectorStore: OracleVS,
  params?: { [key: string]: any }
): Promise<void> {
  const idxType = params?.idxType || "HNSW";

  if (idxType === "IVF") {
    await createIVFIndex(client, vectorStore, params);
  } else {
    await createHNSWIndex(client, vectorStore, params);
  }
}

async function createHNSWIndex(
  connection: oracledb.Connection,
  oraclevs: OracleVS,
  params?: { [key: string]: any }
): Promise<void> {
  try {
    const defaults: { [key: string]: any } = {
      idxName: "HNSW",
      idxType: "HNSW",
      neighbors: 32,
      efConstruction: 200,
      accuracy: 90,
      parallel: 8,
    };

    // if params then copy params to config
    const config: { [key: string]: any } = params
      ? { ...params }
      : { ...defaults };

    // Ensure compulsory parts are included
    const compulsoryKeys = ["idxName", "parallel"];
    for (const key of compulsoryKeys) {
      if (!(key in config)) {
        if (key === "idxName") {
          config[key] = _getIndexName(defaults[key] as string);
        } else {
          config[key] = defaults[key] as number;
        }
      }
    }

    // Validate keys in config against defaults
    for (const key of Object.keys(config)) {
      if (!(key in defaults)) {
        throw new Error(`Invalid parameter: ${key}`);
      }
    }

    const {idxName} = config;
    const baseSql = `CREATE VECTOR INDEX IF NOT EXISTS ${quoteIdentifier(
      idxName
    )}
                              ON ${oraclevs.tableName}(embedding) 
                              ORGANIZATION INMEMORY NEIGHBOR GRAPH`;
    const accuracyPart = config.accuracy
      ? ` WITH TARGET ACCURACY ${config.accuracy}`
      : "";
    const distancePart = ` DISTANCE ${oraclevs.distanceStrategy}`;

    let parametersPart = "";
    if ("neighbors" in config && "efConstruction" in config) {
      parametersPart = ` parameters (type ${config.idxType}, 
                                     neighbors ${config.neighbors}, 
                                     efConstruction ${config.efConstruction})`;
    } else if ("neighbors" in config && !("efConstruction" in config)) {
      config.efConstruction = defaults.efConstruction;
      parametersPart = ` parameters (type ${config.idxType}, 
                                     neighbors ${config.neighbors}, 
                                     efConstruction ${config.efConstruction})`;
    } else if (!("neighbors" in config) && "efConstruction" in config) {
      config.neighbors = defaults.neighbors;
      parametersPart = ` parameters (type ${config.idxType}, 
                                     neighbors ${config.neighbors}, 
                                     efConstruction ${config.efConstruction})`;
    }

    const parallelPart = ` PARALLEL ${config.parallel}`;
    const ddl =
      baseSql + accuracyPart + distancePart + parametersPart + parallelPart;
    await connection.execute(ddl);
  } catch (error: unknown) {
    handleError(error);
  }
}

async function createIVFIndex(
  connection: oracledb.Connection,
  oraclevs: OracleVS,
  params?: { [key: string]: any }
): Promise<void> {
  try {
    const defaults: { [key: string]: any } = {
      idxName: "IVF",
      idxType: "IVF",
      neighborPart: 32,
      accuracy: 90,
      parallel: 8,
    };

    // Combine defaults with any provided params. Note: params could contain keys not explicitly declared in IndexConfig
    const config: { [key: string]: any } = params
      ? { ...params }
      : { ...defaults };

    // Ensure compulsory parts are included
    const compulsoryKeys = ["idxName", "parallel"];
    for (const key of compulsoryKeys) {
      if (!(key in config)) {
        if (key === "idxName") {
          config[key] = _getIndexName(defaults[key] as string);
        } else {
          config[key] = defaults[key] as number;
        }
      }
    }

    // Validate keys in config against defaults
    for (const key of Object.keys(config)) {
      if (!(key in defaults)) {
        throw new Error(`Invalid parameter: ${key}`);
      }
    }

    // Base SQL statement
    const {idxName} = config;
    const baseSql = `CREATE VECTOR INDEX IF NOT EXISTS ${quoteIdentifier(
      idxName
    )}
                              ON ${oraclevs.tableName}(embedding) 
                              ORGANIZATION NEIGHBOR PARTITIONS`;

    // Optional parts depending on parameters
    const accuracyPart = config.accuracy
      ? ` WITH TARGET ACCURACY ${config.accuracy}`
      : "";
    const distancePart = ` DISTANCE ${oraclevs.distanceStrategy}`;

    let parametersPart = "";
    if ("idxType" in config && "neighborPart" in config) {
      parametersPart = ` PARAMETERS (type ${config.idxType}, 
                         neighbor partitions ${config.neighborPart})`;
    }

    // Always included part for parallel - assuming parallel is compulsory and always included
    const parallelPart = ` PARALLEL ${config.parallel}`;

    // Combine all parts
    const ddl =
      baseSql + accuracyPart + distancePart + parametersPart + parallelPart;
    await connection.execute(ddl);
  } catch (error: unknown) {
    handleError(error);
  }
}

export async function dropTablePurge(
  connection: oracledb.Connection,
  tableName: string
): Promise<void> {
  try {
    const ddl = `DROP TABLE IF EXISTS ${quoteIdentifier(tableName)} PURGE`;
    await connection.execute(ddl);
  } catch (error: unknown) {
    handleError(error);
  }
}

export class OracleVS extends VectorStore {
  declare FilterType: Metadata;

  readonly client: oracledb.Pool | oracledb.Connection;

  embeddingDimension: number | undefined;

  readonly tableName: string;

  readonly distanceStrategy: DistanceStrategy = DistanceStrategy.COSINE;

  filter?: Metadata;

  readonly query: string;

  _vectorstoreType(): string {
    return "oraclevs";
  }

  constructor(embeddings: EmbeddingsInterface, dbConfig: OracleDBVSStoreArgs) {
    super(embeddings, dbConfig);

    try {
      this.client = dbConfig.client;
      this.tableName = quoteIdentifier(dbConfig.tableName);
      this.distanceStrategy =
        dbConfig.distanceStrategy ?? this.distanceStrategy;
      this.query = dbConfig.query;
      this.filter = dbConfig.filter;
    } catch (error: unknown) {
      handleError(error);
    }
  }

  async getEmbeddingDimension(query: string): Promise<number> {
    const embeddingVector = await this.embeddings.embedQuery(query);
    return embeddingVector.length;
  }

  async initialize(): Promise<void> {
    let connection: oracledb.Connection | null = null;
    try {
      this.embeddingDimension = await this.getEmbeddingDimension(this.query);
      connection = await this.getConnection();
      await createTable(connection, this.tableName, this.embeddingDimension);
    } catch (error: unknown) {
      handleError(error);
    } finally {
      if (connection) await this.retConnection(connection);
    }
  }

  public async getConnection(): Promise<oracledb.Connection> {
    try {
      if (isPool(this.client)) {
        return await (this.client as oracledb.Pool).getConnection();
      }
      return this.client as oracledb.Connection;
    } catch (error: unknown) {
      handleError(error);
    }
  }

  // Close connection or return it to the pool
  public async retConnection(connection: oracledb.Connection): Promise<void> {
    try {
      // If the client is a pool, close the connection (return it to the pool)
      if (isPool(this.client)) {
        await connection.close();
      }
    } catch (error) {
      console.error("Error in retConnection:", error);
      throw error;
    }
  }

  /**
   * Method to add vectors to the Oracle database.
   * @param vectors The vectors to add.
   * @param documents The documents associated with the vectors.
   * @param options
   * @returns Promise that resolves when the vectors have been added.
   */
  public async addVectors(
    vectors: number[][],
    documents: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<string[] | undefined> {
    if (vectors.length === 0) {
      throw new Error("Vectors input null. Nothing to add...");
    }

    const ids: string[] = options?.ids;
    let connection: oracledb.Connection | null = null;

    try {
      // Ensure there are IDs for all documents
      if (ids !== undefined && ids.length !== vectors.length) {
        throw new Error(
          "The number of ids must match the number of vectors provided."
        );
      }

      connection = await this.getConnection();
      const binds = [];
      for (let index = 0; index < documents.length; index += 1) {
        const doc = documents[index];
        let processedId;
        if (ids) {
          processedId = createHash("sha256")
            .update(ids[index])
            .digest("hex")
            .substring(0, 16)
            .toUpperCase();
        } else {
          const sourceId = doc.metadata.id ?? crypto.randomUUID();
          processedId = createHash("sha256")
            .update(sourceId)
            .digest("hex")
            .substring(0, 16)
            .toUpperCase();
        }
        const idBuffer = Buffer.from(processedId, "hex");

        const bind: any = {
          id: idBuffer,
          text: doc.pageContent,
          metadata: doc.metadata,
          embedding: new Float32Array(vectors[index]),
        };
        binds.push(bind);
      }
      const sql = `INSERT INTO ${this.tableName} (id, embedding, text, metadata )
               VALUES (:id, :embedding, :text, :metadata)`;
      const options = {
        bindDefs: {
          id: { type: oracledb.BUFFER, maxSize: 24 },
          text: { type: oracledb.STRING, maxSize: 10000000 },
          metadata: { type: oracledb.DB_TYPE_JSON },
          embedding: { type: oracledb.DB_TYPE_VECTOR },
        },
        autoCommit: false,
      };

      await connection.executeMany(sql, binds, options);

      // Commit once all inserts are queued up
      await connection.commit();
      console.log("All documents have been inserted and committed.");
    } catch (error: any) {
      handleError(error);
    } finally {
      if (connection) {
        await this.retConnection(connection);
      }
    }
    return ids;
  }

  public async addDocuments(
    documents: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<string[] | undefined> {
    const texts = documents.map(({ pageContent }) => pageContent);

    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method to search for vectors that are similar to a given query vector.
   * @param query The query vector.
   * @param k The number of similar vectors to return.
   * @param filter Optional filter for the search results.
   * @returns Promise that resolves with an array of tuples, each containing a Document and a score.
   */
  public async similaritySearchByVectorReturningEmbeddings(
    query: number[],
    k = 4,
    filter?: this["FilterType"]
  ): Promise<[Document, number, Float32Array | number[]][]> {
    const docsScoresAndEmbeddings: Array<
      [Document, number, Float32Array | number[]]
    > = [];

    let connection: oracledb.Connection | null = null;

    try {
      const convertedEmbedding = new Float32Array(query);
      const bindValues: any = [convertedEmbedding];

      let sqlQuery = `
      SELECT id, 
        text,
        metadata,
        vector_distance(embedding, :embedding, ${this.distanceStrategy}) as distance,
        embedding
      FROM ${this.tableName} `;
      if (filter && Object.keys(filter).length > 0) {
        sqlQuery += " WHERE JSON_EQUAL(metadata, :filter)";
        bindValues.push({ type: oracledb.DB_TYPE_JSON, val: filter });
      }
      sqlQuery += " ORDER BY distance FETCH APPROX FIRST :k ROWS ONLY ";
      bindValues.push(k);

      // Execute the query
      connection = await this.getConnection();
      const resultSet = await connection.execute(sqlQuery, bindValues, {
        fetchInfo: {
          TEXT: { type: oracledb.STRING },
        },
      } as unknown as oracledb.ExecuteOptions);

      if (Array.isArray(resultSet.rows) && resultSet.rows.length > 0) {
        const rows = resultSet.rows as unknown[][];

        for (let idx = 0; idx < resultSet.rows.length; idx += 1) {
          const row = rows[idx];
          const text = row[1] as string;
          const metadata = row[2] as Metadata;
          const distance = row[3] as number;
          const embedding = row[4] as any;

          const document = new Document({
            pageContent: text || "",
            metadata: metadata || {},
          });
          docsScoresAndEmbeddings.push([document, distance, embedding]);
        }
      } else {
        // Throw an exception if no rows are found
        throw new Error("No rows found.");
      }
    } finally {
      if (connection) {
        await connection.close();
      }
    }
    return docsScoresAndEmbeddings;
  }

  public async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[DocumentInterface, number][]> {
    const docsScoresAndEmbeddings =
      await this.similaritySearchByVectorReturningEmbeddings(query, k, filter);
    return docsScoresAndEmbeddings.map(([document, score]) => [
      document,
      score,
    ]);
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND diversity
   * among selected documents.
   *
   * @param {string} query - Text to look up documents similar to.
   * @param options
   * @param {number} options.k - Number of documents to return.
   * @param {number} options.fetchK - Number of documents to fetch before passing to the MMR algorithm.
   * @param {number} options.lambda - Number between 0 and 1 that determines the degree of diversity among the results,
   *                 where 0 corresponds to maximum diversity and 1 to minimum diversity.
   * @param {this["FilterType"]} options.filter - Optional filter
   * @param _callbacks
   *
   * @returns {Promise<DocumentInterface[]>} - List of documents selected by maximal marginal relevance.
   */
  public async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    const embedding = await this.embeddings.embedQuery(query);
    return await this.maxMarginalRelevanceSearchByVector(embedding, options);
  }

  public async maxMarginalRelevanceSearchByVector(
    embedding: number[],
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    // Fetch documents and their scores. This calls the previously adapted function.
    const docsAndScores =
      await this.maxMarginalRelevanceSearchWithScoreByVector(
        embedding,
        options
      );

    // Extract and return only the documents from the results
    return docsAndScores.map((ds) => ds.document);
  }

  public async maxMarginalRelevanceSearchWithScoreByVector(
    embedding: number[],
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Array<{ document: Document; score: number }>> {
    // Fetch documents and their scores.
    const docsScoresEmbeddings =
      await this.similaritySearchByVectorReturningEmbeddings(
        embedding,
        options.fetchK,
        options.filter
      );

    if (!docsScoresEmbeddings.length) {
      return [];
    }

    // Split documents, scores, and embeddings
    const documents: Document[] = docsScoresEmbeddings.map(
      ([document]) => document
    );
    const scores: number[] = docsScoresEmbeddings.map(([, score]) => score);
    const embeddings: (Float32Array | number[])[] = docsScoresEmbeddings.map(
      ([, , embedding]) => new Float32Array(embedding)
    );

    // Convert all embeddings to Float32Array for consistency
    const consistentEmbeddings: number[][] = embeddings.map((embedding) =>
      Array.from(embedding)
    );
    const queryEmbedding: number[] = Array.from(embedding);

    // Ensure lambdaMult has a default value if not provided
    const lambdaMult = 0.5;
    const mmrSelectedIndices: number[] = maximalMarginalRelevance(
      queryEmbedding,
      consistentEmbeddings,
      lambdaMult,
      options.k
    );

    // Filter documents based on MMR-selected indices and map scores
    return mmrSelectedIndices.map((index) => ({
      document: documents[index],
      score: scores[index],
    }));
  }

  public async delete(params: {
    ids?: string[];
    deleteAll?: boolean;
  }): Promise<void> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await this.getConnection();
      const options = { autoCommit: true };
      if (params.ids && params.ids.length > 0) {
        // Dynamically create placeholders
        const placeholders = params.ids
          .map((_, index) => `:${index + 1}`)
          .join(",");
        // Prepare the query
        const query = `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`;
        // Execute the query with the IDs as bind parameters
        await connection.execute(query, [...params.ids], options);
      } else if (params.deleteAll) {
        await connection.execute(
          `TRUNCATE TABLE ${this.tableName}`,
          [],
          options
        );
      }
    } catch (error: unknown) {
      handleError(error);
    } finally {
      if (connection) await connection.close();
    }
  }

  static async fromDocuments(
    documents: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: OracleDBVSStoreArgs
  ): Promise<OracleVS> {
    const {client} = dbConfig;
    if (!client) throw new Error("client parameter is required...");

    try {
      const vss = new OracleVS(embeddings, dbConfig);
      await vss.initialize();

      const texts = documents.map(({ pageContent }) => pageContent);
      const vectors = await embeddings.embedDocuments(texts);

      // Assuming a method exists to handle adding texts and metadata appropriately
      await vss.addVectors(vectors, documents);

      return vss;
    } catch (error: unknown) {
      handleError(error);
    }
  }

  /**
   *
   * @returns Promise that resolves when all connections
   * inside the pool are terminated.
   */
  async end(): Promise<void> {
    if (isPool(this.client)) {
      await this.client?.close();
    }
  }
}
