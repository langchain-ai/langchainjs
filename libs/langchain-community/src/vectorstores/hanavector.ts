import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  VectorStore,
  MaxMarginalRelevanceSearchOptions,
} from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
// import type hanaClient from "@sap/hana-client";

export type DistanceStrategy = "euclidean" | "cosine";

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

interface Filter {
  [key: string]: boolean | string | number;
}

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

  declare FilterType: Filter;

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
      args.vectorColumnLength || defaultVectorColumnLength
    ); // Using '??' to allow 0 as a valid value

    this.connection = args.connection;

    // this.initialize();
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static sanitizeInt(inputInt: any): number {
    const value = parseInt(inputInt.toString(), 10);
    if (Number.isNaN(value) || value < -1) {
      throw new Error(`Value (${value}) must not be smaller than -1`);
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

      // Check length, if parameter was provided
      if (columnLength !== undefined && length !== columnLength) {
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

      sqlStr +=
        this.vectorColumnLength === -1
          ? ");"
          : `(${this.vectorColumnLength}));`;
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
    filter?: Filter
  ): [string, Array<string | number | boolean>] {
    const queryTuple: Array<string | number | boolean> = [];
    let whereStr = "";
    if (filter) {
      Object.keys(filter).forEach((key, i) => {
        whereStr += i === 0 ? " WHERE " : " AND ";
        whereStr += ` JSON_VALUE(${this.metadataColumn}, '$.${key}') = ?`;

        const value = filter[key];
        if (typeof value === "number") {
          if (Number.isInteger(value)) {
            // hdb requires string while sap/hana-client doesn't
            queryTuple.push(value.toString()); 
          } else {
            throw new Error(
              `Unsupported filter data-type: wrong number type for key ${key}`
            );
          }
        } else if (typeof value === "string") {
          queryTuple.push(value);
        } else if (typeof value === "boolean") {
          queryTuple.push(value.toString());
        } else {
          throw new Error(
            `Unsupported filter data-type: ${typeof value} for key ${key}`
          );
        }
      });
    }

    return [whereStr, queryTuple];
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
    filter?: Filter;
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
    filter?: Filter
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
    filter?: Filter
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
    filter?: Filter
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
    filter?: Filter
  ): Promise<Array<[Document, number, number[]]>> {
    // const result: Array<[Document, number, number[]]> = [];
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
    // console.log(options)
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
