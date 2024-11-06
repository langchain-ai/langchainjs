import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  VectorStore,
  MaxMarginalRelevanceSearchOptions,
} from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";

export type DistanceStrategy = "euclidean" | "cosine";

const COMPARISONS_TO_SQL: Record<string, string> = {
  $eq: "=",
  $ne: "<>",
  $lt: "<",
  $lte: "<=",
  $gt: ">",
  $gte: ">=",
};

interface FilterObject {
  [key: string]: FilterValue;
}

type FilterValue =
  | string
  | number
  | boolean
  | Date
  | FilterObject
  | Array<FilterValue>;

const IN_OPERATORS_TO_SQL: Record<string, string> = {
  $in: "IN",
  $nin: "NOT IN",
};

const BETWEEN_OPERATOR_TO_SQL: Record<string, string> = {
  $between: "BETWEEN",
};

const LIKE_OPERATOR_TO_SQL: Record<string, string> = {
  $like: "LIKE",
};

const LOGICAL_OPERATORS_TO_SQL: Record<string, string> = {
  $and: "AND",
  $or: "OR",
};

const HANA_DISTANCE_FUNCTION: Record<DistanceStrategy, [string, string]> = {
  cosine: ["COSINE_SIMILARITY", "DESC"],
  euclidean: ["L2DISTANCE", "ASC"],
};

const defaultDistanceStrategy = "cosine";
const defaultTableName = "EMBEDDINGS";
const defaultContentColumn = "VEC_TEXT";
const defaultMetadataColumn = "VEC_META";
const defaultVectorColumn = "VEC_VECTOR";
const defaultVectorColumnLength = -1; // -1 means dynamic length

/**
 * Interface defining the arguments required to create an instance of
 * `HanaDB`.
 */
export interface HanaDBArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connection: any;
  distanceStrategy?: DistanceStrategy;
  tableName?: string;
  contentColumn?: string;
  metadataColumn?: string;
  vectorColumn?: string;
  vectorColumnLength?: number;
  specificMetadataColumns?: string[];
}

export class HanaDB extends VectorStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private connection: any;

  private distanceStrategy: DistanceStrategy;

  // Compile pattern only once, for better performance
  private static compiledPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  private tableName: string;

  private contentColumn: string;

  private metadataColumn: string;

  private vectorColumn: string;

  private vectorColumnLength: number;

  private specificMetadataColumns: string[];

  _vectorstoreType(): string {
    return "hanadb";
  }

  constructor(embeddings: EmbeddingsInterface, args: HanaDBArgs) {
    super(embeddings, args);
    this.distanceStrategy = args.distanceStrategy || defaultDistanceStrategy;
    this.tableName = HanaDB.sanitizeName(args.tableName || defaultTableName);
    this.contentColumn = HanaDB.sanitizeName(
      args.contentColumn || defaultContentColumn
    );
    this.metadataColumn = HanaDB.sanitizeName(
      args.metadataColumn || defaultMetadataColumn
    );
    this.vectorColumn = HanaDB.sanitizeName(
      args.vectorColumn || defaultVectorColumn
    );
    this.vectorColumnLength = HanaDB.sanitizeInt(
      args.vectorColumnLength || defaultVectorColumnLength,
      -1
    );
    this.specificMetadataColumns = HanaDB.sanitizeSpecificMetadataColumns(
      args.specificMetadataColumns || []
    );
    this.connection = args.connection;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private executeQuery(client: any, query: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.exec(query, (err: Error, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private prepareQuery(client: any, query: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.prepare(query, (err: Error, statement: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(statement);
        }
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private executeStatement(statement: any, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      statement.exec(params, (err: Error, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  public async initialize() {
    let valid_distance = false;
    for (const key in HANA_DISTANCE_FUNCTION) {
      if (key === this.distanceStrategy) {
        valid_distance = true;
        break; // Added to exit loop once a match is found
      }
    }
    if (!valid_distance) {
      throw new Error(
        `Unsupported distance_strategy: ${this.distanceStrategy}`
      );
    }
    await this.createTableIfNotExists();
    await this.checkColumn(this.tableName, this.contentColumn, [
      "NCLOB",
      "NVARCHAR",
    ]);
    await this.checkColumn(this.tableName, this.metadataColumn, [
      "NCLOB",
      "NVARCHAR",
    ]);
    await this.checkColumn(
      this.tableName,
      this.vectorColumn,
      ["REAL_VECTOR"],
      this.vectorColumnLength
    );
  }
  /**
   * Sanitizes the input string by removing characters that are not alphanumeric or underscores.
   * @param inputStr The string to be sanitized.
   * @returns The sanitized string.
   */

  public static sanitizeName(inputStr: string): string {
    return inputStr.replace(/[^a-zA-Z0-9_]/g, "");
  }

  /**
   * Sanitizes the input to integer. Throws an error if the value is less than -1.
   * @param inputInt The input to be sanitized.
   * @returns The sanitized integer.
   */
  public static sanitizeInt(inputInt: number | string, lowerBound = 0): number {
    const value = parseInt(inputInt.toString(), 10);
    if (Number.isNaN(value) || value < lowerBound) {
      throw new Error(
        `Value (${value}) must not be smaller than ${lowerBound}`
      );
    }
    return value;
  }

  /**
   * Sanitizes a list to ensure all elements are floats (numbers in TypeScript).
   * Throws an error if any element is not a number.
   *
   * @param {number[]} embedding - The array of numbers (floats) to be sanitized.
   * @returns {number[]} The sanitized array of numbers (floats).
   * @throws {Error} Throws an error if any element is not a number.
   */
  public static sanitizeListFloat(embedding: number[]): number[] {
    if (!Array.isArray(embedding)) {
      throw new Error(
        `Expected 'embedding' to be an array, but received ${typeof embedding}`
      );
    }
    embedding.forEach((value) => {
      if (typeof value !== "number") {
        throw new Error(`Value (${value}) does not have type number`);
      }
    });
    return embedding;
  }

  /**
   * Sanitizes the keys of the metadata object to ensure they match the required pattern.
   * Throws an error if any key does not match the pattern.
   *
   * @param {Record<string, any>} metadata - The metadata object with keys to be validated.
   * @returns {object[] | object} The original metadata object if all keys are valid.
   * @throws {Error} Throws an error if any metadata key is invalid.
   */
  private sanitizeMetadataKeys(metadata: object[] | object): object[] | object {
    if (!metadata) {
      return {};
    }
    Object.keys(metadata).forEach((key) => {
      if (!HanaDB.compiledPattern.test(key)) {
        throw new Error(`Invalid metadata key ${key}`);
      }
    });
    return metadata;
  }

  static sanitizeSpecificMetadataColumns(columns: string[]): string[] {
    return columns.map((column) => this.sanitizeName(column));
  }

  /**
   * Parses a string representation of a float array and returns an array of numbers.
   * @param {string} arrayAsString - The string representation of the array.
   * @returns {number[]} An array of floats parsed from the string.
   */
  public static parseFloatArrayFromString(arrayAsString: string): number[] {
    const arrayWithoutBrackets = arrayAsString.slice(1, -1);
    return arrayWithoutBrackets.split(",").map((x) => parseFloat(x));
  }

  /**
   * Checks if the specified column exists in the table and validates its data type and length.
   * @param tableName The name of the table.
   * @param columnName The name of the column to check.
   * @param columnType The expected data type(s) of the column.
   * @param columnLength The expected length of the column. Optional.
   */
  public async checkColumn(
    tableName: string,
    columnName: string,
    columnType: string | string[],
    columnLength?: number
  ): Promise<void> {
    const sqlStr = `
            SELECT DATA_TYPE_NAME, LENGTH 
            FROM SYS.TABLE_COLUMNS 
            WHERE SCHEMA_NAME = CURRENT_SCHEMA 
            AND TABLE_NAME = ? 
            AND COLUMN_NAME = ?`;
    const client = this.connection; // Get the connection object
    // Prepare the statement with parameter placeholders
    const stm = await this.prepareQuery(client, sqlStr);
    // Execute the query with actual parameters to avoid SQL injection
    const resultSet = await this.executeStatement(stm, [tableName, columnName]);
    if (resultSet.length === 0) {
      throw new Error(`Column ${columnName} does not exist`);
    } else {
      const dataType: string = resultSet[0].DATA_TYPE_NAME;
      const length: number = resultSet[0].LENGTH;

      // Check if dataType is within columnType
      const isValidType = Array.isArray(columnType)
        ? columnType.includes(dataType)
        : columnType === dataType;
      if (!isValidType) {
        throw new Error(`Column ${columnName} has the wrong type: ${dataType}`);
      }

      // Length can either be -1 (QRC01+02-24) or 0 (QRC03-24 onwards)
      // to indicate no length constraint being present.

      // Check length, if parameter was provided
      if (columnLength !== undefined && length !== columnLength && length > 0) {
        throw new Error(`Column ${columnName} has the wrong length: ${length}`);
      }
    }
  }

  private async createTableIfNotExists() {
    const tableExists = await this.tableExists(this.tableName);
    if (!tableExists) {
      let sqlStr =
        `CREATE TABLE "${this.tableName}" (` +
        `"${this.contentColumn}" NCLOB, ` +
        `"${this.metadataColumn}" NCLOB, ` +
        `"${this.vectorColumn}" REAL_VECTOR`;
      // Length can either be -1 (QRC01+02-24) or 0 (QRC03-24 onwards)
      if (this.vectorColumnLength === -1 || this.vectorColumnLength === 0) {
        sqlStr += ");";
      } else {
        sqlStr += `(${this.vectorColumnLength}));`;
      }

      const client = this.connection;
      await this.executeQuery(client, sqlStr);
    }
  }

  public async tableExists(tableName: string): Promise<boolean> {
    const tableExistsSQL = `SELECT COUNT(*) AS COUNT FROM SYS.TABLES WHERE SCHEMA_NAME = CURRENT_SCHEMA AND TABLE_NAME = ?`;
    const client = this.connection; // Get the connection object

    const stm = await this.prepareQuery(client, tableExistsSQL);
    const resultSet = await this.executeStatement(stm, [tableName]);
    if (resultSet[0].COUNT === 1) {
      // Table does  exist
      return true;
    }
    return false;
  }

  /**
   * Creates a WHERE clause based on the provided filter object.
   * @param filter - A filter object with keys as metadata fields and values as filter values.
   * @returns A tuple containing the WHERE clause string and an array of query parameters.
   */
  private createWhereByFilter(
    filter?: FilterObject
  ): [string, Array<FilterValue>] {
    let whereStr = "";
    let queryTuple: Array<FilterValue> = [];

    if (filter && Object.keys(filter).length > 0) {
      const [where, params] = this.processFilterObject(filter);
      whereStr = ` WHERE ${where}`;
      queryTuple = params;
    }

    return [whereStr, queryTuple];
  }

  /**
   * Processes a filter object to generate SQL WHERE clause components.
   * @param filter - A filter object with keys as metadata fields and values as filter values.
   * @returns A tuple containing the WHERE clause string and an array of query parameters.
   */
  private processFilterObject(
    filter: FilterObject
  ): [string, Array<FilterValue>] {
    let whereStr = "";
    const queryTuple: Array<FilterValue> = [];

    Object.keys(filter).forEach((key, i) => {
      const filterValue = filter[key];
      if (i !== 0) {
        whereStr += " AND ";
      }

      // Handling logical operators ($and, $or)
      if (key in LOGICAL_OPERATORS_TO_SQL) {
        const logicalOperator = LOGICAL_OPERATORS_TO_SQL[key];
        const logicalOperands = filterValue as FilterObject[];
        logicalOperands.forEach((operand: FilterObject, j: number) => {
          if (j !== 0) {
            whereStr += ` ${logicalOperator} `;
          }
          const [whereLogical, paramsLogical] =
            this.processFilterObject(operand);
          whereStr += "(" + whereLogical + ")";
          queryTuple.push(...paramsLogical);
        });

        return;
      }

      // Handle special comparison operators and simple types
      let operator = "=";
      let sqlParam = "?";
      if (typeof filterValue === "number") {
        if (Number.isInteger(filterValue)) {
          // hdb requires string while sap/hana-client doesn't
          queryTuple.push(filterValue.toString());
        } else {
          throw new Error(
            `Unsupported filter data-type: wrong number type for key ${key}`
          );
        }
      } else if (typeof filterValue === "string") {
        queryTuple.push(filterValue);
      } else if (typeof filterValue === "boolean") {
        queryTuple.push(filterValue.toString());
      } else if (typeof filterValue === "object" && filterValue !== null) {
        // Get the special operator key, like $eq, $ne, $in, $between, etc.
        const specialOp = Object.keys(filterValue)[0];
        const specialVal = (filterValue as FilterObject)[specialOp];
        // Handling of 'special' operators starting with "$"
        if (specialOp in COMPARISONS_TO_SQL) {
          operator = COMPARISONS_TO_SQL[specialOp];
          if (typeof specialVal === "boolean") {
            queryTuple.push(specialVal.toString());
          } else if (typeof specialVal === "number") {
            sqlParam = "CAST(? as float)";
            queryTuple.push(specialVal);
          } else if (
            typeof specialVal === "object" &&
            "type" in specialVal &&
            specialVal.type === "date"
          ) {
            sqlParam = "CAST(? as DATE)";
            queryTuple.push(specialVal.date);
          } else {
            queryTuple.push(specialVal);
          }
        } else if (specialOp in BETWEEN_OPERATOR_TO_SQL) {
          // ensure the value is an array with exact length of 2
          if (!Array.isArray(specialVal) || specialVal.length !== 2) {
            throw new Error(`Operator '${specialOp}' expects two values.`);
          }
          const [betweenFrom, betweenTo] = specialVal as [
            FilterValue,
            FilterValue
          ];
          operator = BETWEEN_OPERATOR_TO_SQL[specialOp];
          sqlParam = "? AND ?";
          queryTuple.push(betweenFrom.toString(), betweenTo.toString());
        } else if (specialOp in LIKE_OPERATOR_TO_SQL) {
          operator = LIKE_OPERATOR_TO_SQL[specialOp];
          if (specialVal !== undefined) {
            queryTuple.push(specialVal.toString());
          } else {
            throw new Error(
              `Operator '${specialOp}' expects a non-undefined value.`
            );
          }
        } else if (specialOp in IN_OPERATORS_TO_SQL) {
          operator = IN_OPERATORS_TO_SQL[specialOp];
          if (Array.isArray(specialVal)) {
            const placeholders = Array(specialVal.length).fill("?").join(",");
            sqlParam = `(${placeholders})`;
            queryTuple.push(
              ...specialVal.map((listEntry) => listEntry.toString())
            );
          } else {
            throw new Error(`Unsupported value for ${operator}: ${specialVal}`);
          }
        } else {
          throw new Error(`Unsupported operator: ${specialOp}`);
        }
      } else {
        throw new Error(`Unsupported filter data-type: ${typeof filterValue}`);
      }

      // Metadata column handling
      const selector = this.specificMetadataColumns.includes(key)
        ? `"${key}"`
        : `JSON_VALUE(${this.metadataColumn}, '$.${key}')`;
      whereStr += `${selector} ${operator} ${sqlParam}`;
    });
    return [whereStr, queryTuple];
  }

  /**
   * Creates an HNSW vector index on a specified table and vector column with
   * optional build and search configurations. If no configurations are provided,
   * default parameters from the database are used. If provided values exceed the
   * valid ranges, an error will be raised.
   * The index is always created in ONLINE mode.
   *
   * @param {object} options Object containing configuration options for the index
   * @param {number} [options.m] (Optional) Maximum number of neighbors per graph node (Valid Range: [4, 1000])
   * @param {number} [options.efConstruction] (Optional) Maximal candidates to consider when building the graph
   *                                           (Valid Range: [1, 100000])
   * @param {number} [options.efSearch] (Optional) Minimum candidates for top-k-nearest neighbor queries
   *                                     (Valid Range: [1, 100000])
   * @param {string} [options.indexName] (Optional) Custom index name. Defaults to <table_name>_<distance_strategy>_idx
   * @returns {Promise<void>} Promise that resolves when index is added.
   */
  public async createHnswIndex(
    options: {
      m?: number;
      efConstruction?: number;
      efSearch?: number;
      indexName?: string;
    } = {}
  ): Promise<void> {
    // Destructure the options inside the function body
    const { m, efConstruction, efSearch, indexName } = options;

    // Determine the distance function based on the configured strategy
    const distanceFuncName = HANA_DISTANCE_FUNCTION[this.distanceStrategy][0];
    const defaultIndexName = `${this.tableName}_${distanceFuncName}_idx`;

    // Use provided indexName or fallback to default
    // const finalIndexName = indexName || defaultIndexName;
    const finalIndexName = HanaDB.sanitizeName(indexName || defaultIndexName);
    // Initialize buildConfig and searchConfig objects
    const buildConfig: Record<string, number> = {};
    const searchConfig: Record<string, number> = {};

    // Validate and add m parameter to buildConfig if provided
    if (m !== undefined) {
      const minimumHnswM = 4;
      const maximumHnswM = 1000;
      const sanitizedM = HanaDB.sanitizeInt(m, minimumHnswM);
      if (sanitizedM < minimumHnswM || sanitizedM > maximumHnswM) {
        throw new Error("M must be in the range [4, 1000]");
      }
      buildConfig.M = sanitizedM;
    }

    // Validate and add efConstruction to buildConfig if provided
    if (efConstruction !== undefined) {
      const minimumEfConstruction = 1;
      const maximumEfConstruction = 100000;
      const sanitizedEfConstruction = HanaDB.sanitizeInt(
        efConstruction,
        minimumEfConstruction
      );
      if (
        sanitizedEfConstruction < minimumEfConstruction ||
        sanitizedEfConstruction > maximumEfConstruction
      ) {
        throw new Error("efConstruction must be in the range [1, 100000]");
      }
      buildConfig.efConstruction = sanitizedEfConstruction;
    }

    // Validate and add efSearch to searchConfig if provided
    if (efSearch !== undefined) {
      const minimumEfSearch = 1;
      const maximumEfSearch = 100000;
      const sanitizedEfSearch = HanaDB.sanitizeInt(efSearch, minimumEfSearch);
      if (
        sanitizedEfSearch < minimumEfSearch ||
        sanitizedEfSearch > maximumEfSearch
      ) {
        throw new Error("efSearch must be in the range [1, 100000]");
      }
      searchConfig.efSearch = sanitizedEfSearch;
    }

    // Convert buildConfig and searchConfig to JSON strings if they contain values
    const buildConfigStr = Object.keys(buildConfig).length
      ? JSON.stringify(buildConfig)
      : "";
    const searchConfigStr = Object.keys(searchConfig).length
      ? JSON.stringify(searchConfig)
      : "";

    // Create the base SQL string for index creation
    let sqlStr = `CREATE HNSW VECTOR INDEX ${finalIndexName} ON "${this.tableName}" ("${this.vectorColumn}") 
                  SIMILARITY FUNCTION ${distanceFuncName} `;

    // Append buildConfig to the SQL string if provided
    if (buildConfigStr) {
      sqlStr += `BUILD CONFIGURATION '${buildConfigStr}' `;
    }

    // Append searchConfig to the SQL string if provided
    if (searchConfigStr) {
      sqlStr += `SEARCH CONFIGURATION '${searchConfigStr}' `;
    }

    // Add the ONLINE option
    sqlStr += "ONLINE;";

    const client = this.connection;
    await this.executeQuery(client, sqlStr);
  }

  /**
   * Deletes entries from the table based on the provided filter.
   * @param ids - Optional. Deletion by ids is not supported and will throw an error.
   * @param filter - Optional. A filter object to specify which entries to delete.
   * @throws Error if 'ids' parameter is provided, as deletion by ids is not supported.
   * @throws Error if 'filter' parameter is not provided, as it is required for deletion.
   * to do: adjust the call signature
   */
  public async delete(options: {
    ids?: string[];
    filter?: FilterObject;
  }): Promise<void> {
    const { ids, filter } = options;
    if (ids) {
      throw new Error("Deletion via IDs is not supported");
    }
    if (!filter) {
      throw new Error("Parameter 'filter' is required when calling 'delete'");
    }

    const [whereStr, queryTuple] = this.createWhereByFilter(filter);
    const sqlStr = `DELETE FROM "${this.tableName}" ${whereStr}`;
    const client = this.connection;
    const stm = await this.prepareQuery(client, sqlStr);
    await this.executeStatement(stm, queryTuple);
  }

  /**
   * Static method to create a HanaDB instance from raw texts. This method embeds the documents,
   * creates a table if it does not exist, and adds the documents to the table.
   * @param texts Array of text documents to add.
   * @param metadatas metadata for each text document.
   * @param embedding EmbeddingsInterface instance for document embedding.
   * @param dbConfig Configuration for the HanaDB.
   * @returns A Promise that resolves to an instance of HanaDB.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbConfig: HanaDBArgs
  ): Promise<HanaDB> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return HanaDB.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Creates an instance of `HanaDB` from an array of
   * Document instances. The documents are added to the database.
   * @param docs List of documents to be converted to vectors.
   * @param embeddings Embeddings instance used to convert the documents to vectors.
   * @param dbConfig Configuration for the HanaDB.
   * @returns Promise that resolves to an instance of `HanaDB`.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: HanaDBArgs
  ): Promise<HanaDB> {
    const instance = new HanaDB(embeddings, dbConfig);
    await instance.initialize();
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Adds an array of documents to the table. The documents are first
   * converted to vectors using the `embedDocuments` method of the
   * `embeddings` instance.
   * @param documents Array of Document instances to be added to the table.
   * @returns Promise that resolves when the documents are added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Adds an array of vectors and corresponding documents to the database.
   * The vectors and documents are batch inserted into the database.
   * @param vectors Array of vectors to be added to the table.
   * @param documents Array of Document instances corresponding to the vectors.
   * @returns Promise that resolves when the vectors and documents are added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    if (vectors.length !== documents.length) {
      throw new Error(`Vectors and metadatas must have the same length`);
    }
    const texts = documents.map((doc) => doc.pageContent);
    const metadatas = documents.map((doc) => doc.metadata);
    const client = this.connection;
    const sqlParams: [string, string, string][] = texts.map((text, i) => {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      // Ensure embedding is generated or provided
      const embeddingString = `[${vectors[i].join(", ")}]`;
      // Prepare the SQL parameters
      return [
        text,
        JSON.stringify(this.sanitizeMetadataKeys(metadata)),
        embeddingString,
      ];
    });
    // Insert data into the table, bulk insert.
    const sqlStr = `INSERT INTO "${this.tableName}" ("${this.contentColumn}", "${this.metadataColumn}", "${this.vectorColumn}") 
                    VALUES (?, ?, TO_REAL_VECTOR(?));`;
    const stm = await this.prepareQuery(client, sqlStr);
    await this.executeStatement(stm, sqlParams);
    // stm.execBatch(sqlParams);
  }

  /**
     * Return docs most similar to query.
     * @param query Query text for the similarity search.
     * @param k Number of Documents to return. Defaults to 4.
     * @param filter A dictionary of metadata fields and values to filter by.
                    Defaults to None.
     * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
     */
  async similaritySearch(
    query: string,
    k: number,
    filter?: FilterObject
  ): Promise<Document[]> {
    const results = await this.similaritySearchWithScore(query, k, filter);
    return results.map((result) => result[0]);
  }

  /**
     * Return documents and score values most similar to query.
     * @param query Query text for the similarity search.
     * @param k Number of Documents to return. Defaults to 4.
     * @param filter A dictionary of metadata fields and values to filter by.
                    Defaults to None.
     * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
     */
  async similaritySearchWithScore(
    query: string,
    k: number,
    filter?: FilterObject
  ): Promise<[Document, number][]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    return this.similaritySearchVectorWithScore(queryEmbedding, k, filter);
  }

  /**
     * Return docs most similar to the given embedding.
     * @param query Query embedding for the similarity search.
     * @param k Number of Documents to return. Defaults to 4.
     * @param filter A dictionary of metadata fields and values to filter by.
                    Defaults to None.
     * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
     */
  async similaritySearchVectorWithScore(
    queryEmbedding: number[],
    k: number,
    filter?: FilterObject
  ): Promise<[Document, number][]> {
    const wholeResult = await this.similaritySearchWithScoreAndVectorByVector(
      queryEmbedding,
      k,
      filter
    );
    // Return documents and scores, discarding the vectors
    return wholeResult.map(([doc, score]) => [doc, score]);
  }

  /**
   * Performs a similarity search based on vector comparison and returns documents along with their similarity scores and vectors.
   * @param embedding The vector representation of the query for similarity comparison.
   * @param k The number of top similar documents to return.
   * @param filter Optional filter criteria to apply to the search query.
   * @returns A promise that resolves to an array of tuples, each containing a Document, its similarity score, and its vector.
   */
  async similaritySearchWithScoreAndVectorByVector(
    embedding: number[],
    k: number,
    filter?: FilterObject
  ): Promise<Array<[Document, number, number[]]>> {
    // Sanitize inputs
    const sanitizedK = HanaDB.sanitizeInt(k);
    const sanitizedEmbedding = HanaDB.sanitizeListFloat(embedding);
    // Determine the distance function based on the configured strategy
    const distanceFuncName = HANA_DISTANCE_FUNCTION[this.distanceStrategy][0];
    // Convert the embedding vector to a string for SQL query
    const embeddingAsString = sanitizedEmbedding.join(",");
    let sqlStr = `SELECT TOP ${sanitizedK}
                    "${this.contentColumn}", 
                    "${this.metadataColumn}", 
                    TO_NVARCHAR("${this.vectorColumn}") AS VECTOR, 
                    ${distanceFuncName}("${this.vectorColumn}", TO_REAL_VECTOR('[${embeddingAsString}]')) AS CS
                    FROM "${this.tableName}"`;
    // Add order by clause to sort by similarity
    const orderStr = ` ORDER BY CS ${
      HANA_DISTANCE_FUNCTION[this.distanceStrategy][1]
    }`;

    // Prepare and execute the SQL query
    const [whereStr, queryTuple] = this.createWhereByFilter(filter);

    sqlStr += whereStr + orderStr;
    const client = this.connection;
    const stm = await this.prepareQuery(client, sqlStr);
    const resultSet = await this.executeStatement(stm, queryTuple);
    const result: Array<[Document, number, number[]]> = resultSet.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row: any) => {
        const metadata = JSON.parse(row[this.metadataColumn].toString("utf8"));
        const doc: Document = {
          pageContent: row[this.contentColumn].toString("utf8"),
          metadata,
        };
        const resultVector = HanaDB.parseFloatArrayFromString(row.VECTOR);
        const score = row.CS;
        return [doc, score, resultVector];
      }
    );

    return result;
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   * Maximal marginal relevance optimizes for similarity to the query AND
   * diversity among selected documents.
   * @param query Text to look up documents similar to.
   * @param options.k Number of documents to return.
   * @param options.fetchK=20 Number of documents to fetch before passing to
   *     the MMR algorithm.
   * @param options.lambda=0.5 Number between 0 and 1 that determines the
   *     degree of diversity among the results, where 0 corresponds to maximum
   *     diversity and 1 to minimum diversity.
   * @returns List of documents selected by maximal marginal relevance.
   */
  async maxMarginalRelevanceSearch(
    query: string,
    options: MaxMarginalRelevanceSearchOptions<this["FilterType"]>
  ): Promise<Document[]> {
    const { k, fetchK = 20, lambda = 0.5 } = options;
    const queryEmbedding = await this.embeddings.embedQuery(query);

    const docs = await this.similaritySearchWithScoreAndVectorByVector(
      queryEmbedding,
      fetchK
    );
    // docs is an Array of tuples: [Document, number, number[]]
    const embeddingList = docs.map((doc) => doc[2]); // Extracts the embedding from each tuple
    // Re-rank the results using MMR
    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      lambda,
      k
    );
    const mmrDocs = mmrIndexes.map((index) => docs[index][0]);
    return mmrDocs;
  }
}
