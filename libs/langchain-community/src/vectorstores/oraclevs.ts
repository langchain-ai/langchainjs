import * as oracledb from "oracledb";
import { v4 as uuidv4 } from 'uuid';
import {MaxMarginalRelevanceSearchOptions, VectorStore,} from "@langchain/core/vectorstores";
import {Document, DocumentInterface} from "@langchain/core/documents";
import {Embeddings} from "@langchain/core/embeddings";
import {Callbacks} from "@langchain/core/callbacks/manager";
import {createLogger, format, transports, Logform} from 'winston'
import { maximalMarginalRelevance } from "@langchain/core/utils/math";

export enum DistanceStrategy {
  COSINE,
  DOT_PRODUCT,
  EUCLIDEAN_DISTANCE,
  MANHATTAN_DISTANCE,
  HAMMING_DISTANCE,
  EUCLIDEAN_SQUARED
}

type AddDocumentOptions = Record<string, any>;

interface CustomLogInfo extends Logform.TransformableInfo {
  level: string;
  message: string;
  timestamp?: string;
}

// eslint-disable-next-line no-process-env
const logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'error';

const logger = createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp(),
    format.printf((info: Logform.TransformableInfo) => {
      // Now 'info' is typed, which includes 'level', 'message', and 'timestamp'
      const { level, message, timestamp } = info as CustomLogInfo;
      return `${timestamp} - ${level.toUpperCase()} - ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
  ]
});

function handleError(error: unknown): never {
  // Type guard to check if the error is an object and has 'name' and 'message' properties
  if (typeof error === "object" && error !== null && "name" in error && "message" in error) {
    const err = error as { name: string, message: string };  // Type assertion based on guarded checks

    // Log the error message with appropriate details
    logger.error(`Error occurred: ${err.message}`);

    // Handle specific error types based on the name property
    switch (err.name) {
      case "RuntimeError":
        // Specific log for RuntimeError
        logger.error(`Runtime error during operation: ${err.message}`);
        throw new Error("Database operation failed due to a runtime error.");
      case "ValidationError":
        // Specific log for ValidationError
        logger.error(`Validation error during operation: ${err.message}`);
        throw new Error("Operation failed due to a validation error.");
      default:
        // Log and throw for any other type of error
        logger.error(`Unexpected error during operation: ${err.message}`);
        throw new Error("An unexpected error occurred during the operation.");
    }
  } else {
    // This block handles cases where the error might not be an object or missing expected properties
    logger.error("A non-standard error or non-object was thrown.");
    throw new Error("An unknown and unexpected error occurred.");
  }
}

async function tableExists(connection: oracledb.Connection, tableName: string): Promise<boolean> {
  try {
    await connection.execute(`SELECT COUNT(*) FROM ${tableName}`);
    return true; // If query executes successfully, table exists
  } catch (ex) {
    if (ex instanceof Error && 'errorNum' in ex) {
      const error = ex as oracledb.DBError; // Type casting to use DBError specific fields
      if (error.errorNum === 942) {
        return false; // Table does not exist
      }
    }
    throw ex; // Rethrow the error if it's not the specific 'table does not exist' error
  }
}

async function indexExists(connection: oracledb.Connection, indexName: string): Promise<boolean> {
  try {
    const query = `SELECT index_name
                   FROM all_indexes
                   WHERE upper(index_name) = upper(:idx_name)`;
    const result = await connection.execute(query, {idx_name: indexName.toUpperCase()}, {outFormat: oracledb.OUT_FORMAT_OBJECT});

    // Check if `rows` is defined and has at least one entry
    return !!(result.rows && result.rows.length > 0);
  } catch (error: unknown) {
    handleError(error);
  }
}

function getDistanceFunction(distanceStrategy: DistanceStrategy): string {
  const distanceStrategy2Function: { [key in DistanceStrategy]?: string } = {
    [DistanceStrategy.COSINE]: 'COSINE',
    [DistanceStrategy.EUCLIDEAN_DISTANCE]: 'EUCLIDEAN',
    [DistanceStrategy.DOT_PRODUCT]: 'DOT',
    [DistanceStrategy.MANHATTAN_DISTANCE]: 'MANHATTAN',
    [DistanceStrategy.HAMMING_DISTANCE]: 'HAMMING',
    [DistanceStrategy.EUCLIDEAN_SQUARED]: 'EUCLIDEAN_SQUARED'
  };

  const result = distanceStrategy2Function[distanceStrategy];
  if (result === undefined) {
    throw new Error(`Unsupported distance strategy: ${distanceStrategy}`);
  }

  return result;
}

async function getEmbeddingDimension(embeddings: Embeddings, query: string): Promise<number> {
  if (embeddings instanceof Embeddings) {
    // Assuming embedQuery returns a Promise that resolves to an array
    const embeddingVector = await embeddings.embedQuery(query);
    // Return the length of the embedding vector
    return embeddingVector.length;
  }
  // Handle the case where the input is not an instance of Embeddings or any other appropriate action
  throw new Error('Input is not an instance of Embeddings');
}

export async function createTable(connection: oracledb.Connection, tableName: string, embeddingDim: number): Promise<void> {
  const colsDict = {
    id: 'RAW(16) DEFAULT SYS_GUID() PRIMARY KEY',
    text: 'CLOB',
    metadata: 'CLOB',
    embedding: `vector(${embeddingDim}, FLOAT32)`
  };

  try {
    const tableExistsResult = await tableExists(connection, tableName);
    if (!tableExistsResult) {
      const ddlBody = Object.entries(colsDict).map(([colName, colType]) => `${colName} ${colType}`).join(', ');
      const ddl = `CREATE TABLE ${tableName}
                   (
                       ${ddlBody}
                   )`;
      await connection.execute(ddl);
      console.log("Table created successfully...");
    } else {
      console.log("Table already exists...");
    }
  } catch (error: unknown) {
    handleError(error);
  }
}

function getIndexName(baseName: string): string {
  const uniqueId = uuidv4().replace(/-/g, '');
  return `${baseName}_${uniqueId}`;
}

export async function createIndex(client: oracledb.Connection,
                                  vectorStore: OracleVS,
                                  params?: { [key: string]: any }) : Promise<void> {
  if (params) {
    switch (params.idxType) {
      case 'HNSW':
        await createHNSWIndex(client, vectorStore,  params);
        break;
      case 'IVF':
        await createIVFIndex(client, vectorStore, params);
        break;
      default:
        await createHNSWIndex(client, vectorStore, params);
    }
  } else {
    await createHNSWIndex(client, vectorStore, params);
  }
}

async function createHNSWIndex( connection: oracledb.Connection, oraclevs: OracleVS,
  params?: { [key: string]: any }
): Promise<void> {
  try {
    const defaults : { [key: string]: any } = {
      idx_name: "HNSW",
      idx_type: "HNSW",
      neighbors: 32,
      efConstruction: 200,
      accuracy: 90,
      parallel: 8
    };

    // if params then copy params to config
    let config: { [key: string]: any } = params ? {...params} : {...defaults};

    // Ensure compulsory parts are included
    const compulsoryKeys = ["idx_name", "parallel"];
    compulsoryKeys.forEach(key => {
      if (!(key in config)) {
        if (key === "idx_name") {
          config[key] = getIndexName(defaults[key] as string);
        } else {
          config[key] = defaults[key] as number;
        }
      }
    });

    // Validate keys in config against defaults
    Object.keys(config).forEach(key => {
      if (!(key in defaults)) {
        throw new Error(`Invalid parameter: ${key}`);
      }
    });

    const idxName = config['idx_name'];
    const baseSql = `CREATE VECTOR INDEX ${idxName} ON ${oraclevs.tableName}(embedding) ORGANIZATION INMEMORY NEIGHBOR GRAPH`;
    const accuracyPart = config.accuracy ? ` WITH TARGET ACCURACY ${config.accuracy}` : "";
    const distancePart = ` DISTANCE ${getDistanceFunction(oraclevs.distanceStrategy)}`;

    let parametersPart = "";
    if ("neighbors" in config && "efConstruction" in config) {
      parametersPart = ` parameters (type ${config.idx_type}, neighbors ${config.neighbors}, efConstruction ${config.efConstruction})`;
    } else if ("neighbors" in config && !("efConstruction" in config)) {
      config.efConstruction = defaults.efConstruction;
      parametersPart = ` parameters (type ${config.idx_type}, neighbors ${config.neighbors}, efConstruction ${config.efConstruction})`;
    } else if (!("neighbors" in config) && "efConstruction" in config) {
      config.neighbors = defaults.neighbors;
      parametersPart = ` parameters (type ${config.idx_type}, neighbors ${config.neighbors}, efConstruction ${config.efConstruction})`;
    }

    const parallelPart = ` PARALLEL ${config.parallel}`;

    const ddl = baseSql + accuracyPart + distancePart + parametersPart + parallelPart;

    const idxExists = await indexExists(connection, config['idx_name']);
    if (!idxExists) {
      await connection.execute(ddl);
      console.log("Index created successfully...");
    } else {
      console.log("Index already exists");
    }
  } catch (error: unknown) {
    handleError(error);
  }
}

async function createIVFIndex( connection: oracledb.Connection, oraclevs: OracleVS,
                                params?: { [key: string]: any }
): Promise<void> {
  try {
    const defaults : { [key: string]: any } = {
      idx_name: "IVF",
      idx_type: "IVF",
      neighbor_part: 32,
      accuracy: 90,
      parallel: 8
    };

    // Combine defaults with any provided params. Note: params could contain keys not explicitly declared in IndexConfig
    let config : { [key: string]: any } = params ? {...params} : {...defaults};

    // Ensure compulsory parts are included
    const compulsoryKeys = ["idx_name", "parallel"];
    compulsoryKeys.forEach(key => {
      if (!(key in config)) {
        if (key === "idx_name") {
          config[key] = getIndexName(defaults[key] as string);
        } else {
          config[key] = defaults[key] as any;
        }
      }
    });

    // Validate keys in config against defaults
    Object.keys(config).forEach(key => {
      if (!(key in defaults)) {
        throw new Error(`Invalid parameter: ${key}`);
      }
    });

    // Base SQL statement
    const idxName = config.idx_name;  // Directly accessing since idx_name must exist as ensured by ensureCompulsoryFields
    const baseSql = `CREATE VECTOR INDEX ${idxName} ON ${oraclevs.tableName}(embedding) ORGANIZATION NEIGHBOR PARTITIONS`;

    // Optional parts depending on parameters
    const accuracyPart = config.accuracy ? ` WITH TARGET ACCURACY ${config.accuracy}` : "";
    const distancePart = ` DISTANCE ${getDistanceFunction(oraclevs.distanceStrategy)}`;

    let parametersPart = "";
    if ("idx_type" in config && "neighbor_part" in config) {
      parametersPart = ` PARAMETERS (type ${config.idx_type}, neighbor partitions ${config.neighbor_part})`;
    }

    // Always included part for parallel - assuming parallel is compulsory and always included
    const parallelPart = ` PARALLEL ${config.parallel}`;

    // Combine all parts
    const ddl = baseSql + accuracyPart + distancePart + parametersPart + parallelPart;

    const idxExists = await indexExists(connection, config['idx_name']);
    if (!idxExists) {
      await connection.execute(ddl);
      console.log("Index created successfully...");
    } else {
      console.log("Index already exists");
    }
  } catch (error: unknown) {
    handleError(error);
  }
}
export async function dropTablePurge(connection: oracledb.Connection, tableName: string): Promise<void> {
  try {
    const exists = await tableExists(connection, tableName);
    if (exists) {
      const ddl = `DROP TABLE ${tableName} PURGE`;
      await connection.execute(ddl);
      console.log("Table dropped successfully...");
    } else {
      console.log("Table not found...");
    }
  } catch (error: unknown) {
    handleError(error);
  }
}

export async function dropIndexIfExists(connection: oracledb.Connection, indexName: string): Promise<void> {
  try {
    const exists = await indexExists(connection, indexName);
    if (exists) {
      const dropQuery = `DROP INDEX ${indexName}`;
      await connection.execute(dropQuery);
      console.log(`Index ${indexName} has been dropped.`);
    } else {
      console.log(`Index ${indexName} does not exist.`);
    }
  } catch (error: unknown) {
    handleError(error);
  }
}

export class OracleVS extends VectorStore {

  readonly client: oracledb.Pool;
  readonly embeddings: Embeddings;
  embeddingDimension: number | undefined;
  readonly tableName: string;
  readonly distanceStrategy: DistanceStrategy;
  readonly query: string;

  _vectorstoreType(): string {
    return "oraclevs";
  }

  constructor(embeddings: Embeddings, dbConfig: Record<string, any>) {
    try {
      super(embeddings, dbConfig)
      this.client = dbConfig.client;
      this.tableName = dbConfig.tableName;
      this.distanceStrategy = dbConfig.distanceStrategy;
      this.query = dbConfig.query;

      // Check if embeddings is an instance of Embeddings
      if (!(dbConfig.embeddings instanceof Embeddings)) {
        console.warn(
        "`embeddings is expected to be an Embeddings object, support "
          + "for passing in a function will soon be removed." );
      }
      this.embeddings = dbConfig.embeddings;

    } catch (error: unknown) {
      handleError(error);
    }
  }

  async initialize(): Promise<void> {
    let connection: oracledb.Connection | null = null;
    try {
      this.embeddingDimension = await getEmbeddingDimension(this.embeddings, this.query);
      connection = await this.client.getConnection()
      await createTable(connection, this.tableName, this.embeddingDimension);
    } catch (error: unknown) {
      handleError(error);
    } finally {
      if(connection)
        await connection.close()
    }
  }

  public async getConnection(): Promise<oracledb.Connection> {
    try {
      return await this.client.getConnection()
    } catch (error: unknown) {
      handleError(error);
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
  ): Promise<string[] | void > {
    if (vectors.length === 0) {
      throw new Error("Vectors input null. Nothing to add...");
    }

    let ids: string[] = options?.ids || [];
    let connection: oracledb.Connection | null = null;

    try {
      // Ensure there are IDs for all documents
      if (ids.length === 0) {
        documents.forEach((doc, index) => {
          if (!doc.metadata?.id) {
            throw new Error(`Missing ID in document metadata at index ${index}.`);
          }
          ids.push(doc.metadata.id);
        });
      }

      const binds = documents.map((doc, index) => ({
        id: { val: doc.metadata.id },
        text: { val: doc.pageContent }, // Assuming 'text' should come from 'pageContent'
        metadata: { val: JSON.stringify(doc.metadata) }, // Assuming you want to store metadata as a string
        embedding: { val: vectors[index] } // Make sure vectors align with documents by index
      }));

      connection = await this.client.getConnection();

      await connection.executeMany(
        `INSERT INTO ${this.tableName} (id, text, metadata, embedding)
       VALUES (:id, :text, :metadata, :embedding)`, binds
      );

      await connection.commit();

      return ids;
    } catch (error: unknown) {
      handleError(error);
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  public async addDocuments(
    documents: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<string[] | void> {
    const texts = documents.map(({ pageContent }) => pageContent);

    return this.addVectors(
      await this.embeddings.embedDocuments(texts), documents, options );
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
    k: number = 4,
    filter?: this["FilterType"]
  ): Promise<[Document, number, Float32Array | number[]][]> {
    const docsScoresAndEmbeddings : Array<[Document, number, Float32Array | number[]]> = [];

    interface QueryResultRow {
      id: string; // Assuming 'id' is a string, adjust the type as necessary
      text: string;
      metadata: string; // JSON string
      distance: number; // Assuming distance is a number
      embedding: Float32Array | number[]; // Based on how embedding is stored and returned
    }

    let connection: oracledb.Connection | null = null;
    try {
      const convertedEmbedding = new Float32Array(query);

      const sqlQuery = `
      SELECT id, 
        text,
        metadata,
        vector_distance(embedding, $1, ${getDistanceFunction(this.distanceStrategy)}) as distance,
        embedding
      FROM ${this.tableName}
      ORDER BY vector_distance(embedding, $1, ${getDistanceFunction(this.distanceStrategy)})
      FETCH APPROX FIRST $2 ROWS ONLY `;

      // Execute the query
      connection = await this.client.getConnection()
      const resultSet = await connection.execute(sqlQuery, [convertedEmbedding, k]);

      if (resultSet.rows && resultSet.rows.length > 0) {
        // Assert the type of results.rows for TypeScript
        const results: QueryResultRow[] = resultSet.rows as QueryResultRow[];
        // Filter results if filter is provided
        for (const result of results) {
          const metadata = JSON.parse(result.metadata || '{}');

          if (filter && Object.entries(filter).every(([key, value]) => metadata[key] === value)) {
            const document = new Document({
              pageContent: result.text || '',
              metadata: metadata,
            });
            // @ts-ignore
            const distance = result.distance;
            // @ts-ignore
            const embedding = result.embedding;
            docsScoresAndEmbeddings.push([document, distance, embedding]);
          } else if (!filter) {
            const document = new Document({
              pageContent: result.text || '',
              metadata: metadata,
            });
            // @ts-ignore
            const distance = result.distance;
            // @ts-ignore
            const embedding = result.embedding;
            docsScoresAndEmbeddings.push([document, distance, embedding]);
          }
        }
      } else {
        // Throw an exception if no rows are found
        throw new Error("No rows found.");
      }
      return docsScoresAndEmbeddings;
    } finally {
      if (connection)
        await connection.close()
    }
  }

  public async similaritySearchVectorWithScore(query: number[],
                                  k: number,
                                  filter?: this["FilterType"]):
    Promise<[DocumentInterface, number][]> {
    const docsScoresAndEmbeddings =  await this.similaritySearchByVectorReturningEmbeddings( query, k, filter)
    return docsScoresAndEmbeddings.map(([document, score]) => [document, score]);
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
  public async maxMarginalRelevanceSearch?(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]> | undefined,
    _callbacks: Callbacks | undefined
  ): Promise<DocumentInterface[]> {
    if (!options) {
      options = { k: 10, fetchK: 20 }; // Default values for the options
    }
    const embedding = await this.embeddings.embedQuery(query);
    return await this.maxMarginalRelevanceSearchByVector(embedding, options, _callbacks);
  }

  public async maxMarginalRelevanceSearchByVector(
    embedding: number[],
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]> | undefined,
    _callbacks: Callbacks | undefined // implement passing to embedQuery later
  ): Promise<Document[]> {
    if (!options) {
      options = { k: 10, fetchK: 20 }; // Default values for the options
    }
    // Fetch documents and their scores. This calls the previously adapted function.
    const docsAndScores = await this.maxMarginalRelevanceSearchWithScoreByVector(embedding, options, _callbacks);

    // Extract and return only the documents from the results
    return docsAndScores.map(ds => ds.document);
  }

  public async maxMarginalRelevanceSearchWithScoreByVector(
    embedding: number[],
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"] | undefined>,
    _callbacks: Callbacks | undefined // implement passing to embedQuery later
  ): Promise<Array<{ document: Document; score: number }>> {
    if (!options) {
      options = { k: 10, fetchK: 20 }; // Default values for the options
    }

    // Fetch documents and their scores.
    const docsScoresEmbeddings = await this.similaritySearchByVectorReturningEmbeddings(embedding, options.fetchK, options.filter);

    if (!docsScoresEmbeddings.length) {
      return [];
    }

    // Split documents, scores, and embeddings
    const documents: Document[] = docsScoresEmbeddings.map(([document]) => document);
    const scores: number[] = docsScoresEmbeddings.map(([, score]) => score);
    const embeddings: (Float32Array | number[])[] = docsScoresEmbeddings.map(([,, embedding])=> new Float32Array(
      embedding));

    // Convert all embeddings to Float32Array for consistency
    const consistentEmbeddings: number[][] = embeddings.map(embedding => Array.from(embedding));
    const queryEmbedding: number[] = Array.from(embedding);

    // Ensure lambdaMult has a default value if not provided
    const lambdaMult = 0.5;
    const mmrSelectedIndices: number[] = maximalMarginalRelevance(queryEmbedding,
      consistentEmbeddings,
      lambdaMult,
      options.k);

    // Filter documents based on MMR-selected indices and map scores
    return mmrSelectedIndices.map(index => ({
      document: documents[index],
      score: scores[index]
    }));
  }

  public async delete(params: { ids?: string[], deleteAll?: boolean }): Promise<void> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await this.client.getConnection()
      if (params.ids && params.ids.length > 0) {
        // Dynamically create placeholders
        const placeholders = params.ids.map((_, index) => `:${index + 1}`).join(',');
        // Prepare the query
        const query = `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`;
        // Execute the query with the IDs as bind parameters
        await connection.execute(query, [...params.ids]);
        await connection.commit();
      } else if (params.deleteAll) {
        await connection.execute(`TRUNCATE TABLE ${this.tableName}`)
      }
    } catch (error: unknown) {
      handleError(error);
    } finally {
      if (connection)
        await connection.close()
    }

  }

  static async fromDocuments(documents: DocumentInterface<Record<string, any>>[],
                             embeddings: Embeddings,
                             dbConfig: Record<string, any>): Promise<OracleVS> {
    let connection: oracledb.Connection | null = null;
    const client = dbConfig.client
    if (!client) {
      throw new Error('client parameter is required...');
    }

    try {
      connection = await client.getConnection()
      if (connection)
        await dropTablePurge(connection, dbConfig.tableName);
      else
        throw new Error(`Invalid connection pool, pass a valid pool `);

      const vss = new OracleVS(embeddings, dbConfig);

      // Use Promise.all to wait for all embedQuery promises to resolve
      const vectors = await Promise.all(documents.map(document =>
        embeddings.embedQuery(document.pageContent)
      ));

      // Assuming a method exists to handle adding texts and metadatas appropriately
      await vss.addVectors(vectors, documents);

      return vss;
    } finally {
      if (connection)
        await connection.close()
    }
  }
}
