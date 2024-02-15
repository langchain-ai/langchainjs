import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  VectorStore,
  MaxMarginalRelevanceSearchOptions,
} from "@langchain/core/vectorstores";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import * as hanaClient from "@sap/hana-client";

// const defaultDistanceStrategy = DistanceStrategy.COSINE;
const defaultTableName: string = "EMBEDDINGS";
const defaultContentColumn: string = "VEC_TEXT";
const defaultMetadataColumn: string = "VEC_META";
const defaultVectorColumn: string = "VEC_VECTOR";
const defaultVectorColumnLength: number = -1; // -1 means dynamic length

interface Filter {
  [key: string]: boolean | string | number;
}

enum DistanceStrategy {
  COSINE = "COSINE_SIMILARITY",
  EUCLIDEAN_DISTANCE = "L2DISTANCE",
}

// const HANA_DISTANCE_FUNCTION = {
//     [DistanceStrategy.COSINE]: ("COSINE_SIMILARITY", "DESC"),
//     [DistanceStrategy.EUCLIDEAN_DISTANCE]: ("L2DISTANCE", "ASC"),
//   };

/**
 * Interface defining the arguments required to create an instance of
 * `HanaDB`.
 */
export interface HanaDBArgs {
  connection: hanaClient.Connection;
  // distanceStrategy?: DistanceStrategy;
  tableName?: string;
  contentColumn?: string;
  metadataColumn?: string;
  vectorColumn?: string;
  vectorColumnLength?: number;
}

export class HanaDB extends VectorStore {
  private connection: hanaClient.Connection;
  // private distanceStrategy: DistanceStrategy;
  private tableName: string;
  private contentColumn: string;
  private metadataColumn: string;
  private vectorColumn: string;
  private vectorColumnLength: number;
  declare FilterType: object | string;
  _vectorstoreType(): string {
    return "hanadb";
  }

  constructor(embeddings: EmbeddingsInterface, args: HanaDBArgs) {
    super(embeddings, args);
    // this.distanceStrategy = args.distanceStrategy || defaultDistanceStrategy;
    this.tableName = this.sanitizeName(args.tableName || defaultTableName);
    this.contentColumn = this.sanitizeName(
      args.contentColumn || defaultContentColumn
    );
    this.metadataColumn = this.sanitizeName(
      args.metadataColumn || defaultMetadataColumn
    );
    this.vectorColumn = this.sanitizeName(
      args.vectorColumn || defaultVectorColumn
    );
    this.vectorColumnLength = this.sanitizeInt(
      args.vectorColumnLength || defaultVectorColumnLength
    ); // Using '??' to allow 0 as a valid value

    this.connection = args.connection;
    // this.initialize();
  }

  public async initialize(): Promise<void> {
    try {
      await this.createTableIfNotExists();
      this.checkColumn(this.tableName, this.contentColumn, [
        "NCLOB",
        "NVARCHAR",
      ]);
      this.checkColumn(this.tableName, this.metadataColumn, [
        "NCLOB",
        "NVARCHAR",
      ]);
      this.checkColumn(
        this.tableName,
        this.vectorColumn,
        ["REAL_VECTOR"],
        this.vectorColumnLength
      );
    } catch (error) {
      console.error("Initialization error:", error);
    }
  }
  /**
   * Sanitizes the input string by removing characters that are not alphanumeric or underscores.
   * @param inputStr The string to be sanitized.
   * @returns The sanitized string.
   */
  private sanitizeName(inputStr: string): string {
    return inputStr.replace(/[^a-zA-Z0-9_]/g, "").toUpperCase();
  }

  /**
   * Sanitizes the input integer. Throws an error if the value is less than -1.
   * @param inputInt The input to be sanitized.
   * @returns The sanitized integer.
   */
  private sanitizeInt(inputInt: any): number {
    const value = parseInt(inputInt, 10);
    if (isNaN(value) || value < -1) {
      throw new Error(`Value (${value}) must not be smaller than -1`);
    }
    return value;
  }

  /**
   * Checks if the specified column exists in the table and validates its data type and length.
   * @param tableName The name of the table.
   * @param columnName The name of the column to check.
   * @param columnType The expected data type(s) of the column.
   * @param columnLength The expected length of the column. Optional.
   */
  private async checkColumn(
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

    try {
      const client = this.connection; // Get the connection object
      // Prepare the statement with parameter placeholders
      const stm = client.prepare(sqlStr);
      // Execute the query with actual parameters to avoid SQL injection
      const resultSet = stm.execQuery([tableName, columnName]);

      if (!resultSet.next()) {
        throw new Error(`Column ${columnName} does not exist`);
      } else {
        // Safely assert the type of the returned value to string
        const dataType: string = resultSet.getValue(0) as string;
        const length: number = resultSet.getValue(1) as number;

        // Check if dataType is within columnType
        const isValidType = Array.isArray(columnType)
          ? columnType.includes(dataType)
          : columnType === dataType;
        if (!isValidType) {
          throw new Error(
            `Column ${columnName} has the wrong type: ${dataType}`
          );
        }

        // Check length, if parameter was provided
        if (columnLength != null && length !== columnLength) {
          throw new Error(
            `Column ${columnName} has the wrong length: ${length}`
          );
        }
      }
    } catch (error) {
      console.error("Error checking column:", error);
      throw error; // Rethrow or handle as needed
    } finally {
      // Ensure resources are cleaned up properly
    }
  }

  private async createTableIfNotExists(): Promise<void> {
    const tableExists = await this.tableExists(this.tableName);
    console.log("Table exists:", tableExists);
    if (!tableExists) {
      let sqlStr =
        `CREATE TABLE ${this.tableName} (` +
        `${this.contentColumn} NCLOB, ` +
        `${this.metadataColumn} NCLOB, ` +
        `${this.vectorColumn} REAL_VECTOR`;

      sqlStr +=
        this.vectorColumnLength === -1
          ? ");"
          : `(${this.vectorColumnLength}));`;
      console.log(sqlStr);
      try {
        const client = this.connection;
        await client.exec(sqlStr);
      } catch (error) {
        console.error("Error creating table:", error);
        throw error;
      }
    }
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const tableExistsSQL = `SELECT COUNT(*) AS COUNT FROM SYS.TABLES WHERE SCHEMA_NAME = CURRENT_SCHEMA AND TABLE_NAME = '${tableName.toUpperCase()}'`;
    try {
      const client = this.connection; // Get the connection object
      // console.log(tableExistsSQL)
      const stm = client.prepare(tableExistsSQL);
      const resultSet = stm.execQuery();
      while (resultSet.next()) {
        const result = resultSet.getValue(0);
        if (result === 1) {
          // Table does  exist
          console.log("Table does exist.");
          return true;
        }
      }
    } catch (error) {
      console.error("Error checking table existence:", error);
      throw error;
    }
    return false;
  }

  /**
   * Creates a WHERE clause based on the provided filter object.
   * @param filter - A filter object with keys as metadata fields and values as filter values.
   * @returns A tuple containing the WHERE clause string and an array of query parameters.
   */
  private createWhereByFilter(
    filter: Filter
  ): [string, Array<string | number>] {
    let queryTuple: Array<string | number> = [];
    let whereStr = "";
    if (filter) {
      Object.keys(filter).forEach((key, i) => {
        whereStr += i === 0 ? " WHERE " : " AND ";
        whereStr += ` JSON_VALUE(${this.metadataColumn}, '$.${key}') = ?`;

        const value = filter[key];
        if (typeof value === "boolean") {
          queryTuple.push(value ? "true" : "false");
        } else if (typeof value === "number" || typeof value === "string") {
          queryTuple.push(value);
        } else {
          throw new Error(`Unsupported filter data-type: ${typeof value}`);
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
    const sqlStr = `DELETE FROM ${this.tableName}${whereStr}`;
    // console.log(sqlStr, queryTuple)
    try {
      const client = this.connection;
      await client.execute(sqlStr, queryTuple);
    } finally {
    }
  }

  /**
   * Static method to create a HanaDB instance from raw texts. This method embeds the documents,
   * creates a table if it does not exist, and adds the documents to the table.
   * @param texts Array of text documents to add.
   * @param metadatas Optional metadata for each text document.
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
    // const docs = [];
    // for (let i = 0; i < texts.length; i += 1) {
    // const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
    // const newDoc = new Document({
    //     pageContent: texts[i],
    //     metadata,
    // });
    // docs.push(newDoc);
    // }
    // console.log(docs)
    const instance = new HanaDB(
      embeddings,
      dbConfig
      // Initialize other parameters here
    );
    await instance.initialize();
    await instance.addTexts(texts, metadatas); // Embed and add texts to the database
    return instance;
    // return HanaDB.fromDocuments(docs, embeddings, dbConfig);
  }

  /**
   * Creates an instance of `HanaDB` from an array of
   * Document instances. The documents are added to the collection.
   * @param docs Array of Document instances to be added to the collection.
   * @param embeddings Embeddings instance used to convert the documents to vectors.
   * @param dbConfig Configuration for the HanaDB.
   * @returns Promise that resolves to an instance of `HanaDB`.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbConfig: HanaDBArgs
  ): Promise<HanaDB> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  /**
   * Adds an array of documents to the collection. The documents are first
   * converted to vectors using the `embedDocuments` method of the
   * `embeddings` instance.
   * @param documents Array of Document instances to be added to the collection.
   * @returns Promise that resolves when the documents are added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    console.log(texts);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  /**
   * Adds an array of vectors and corresponding documents to the collection.
   * The vectors and documents are batch inserted into the database.
   * @param vectors Array of vectors to be added to the collection.
   * @param documents Array of Document instances corresponding to the vectors.
   * @returns Promise that resolves when the vectors and documents are added.
   */
  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {}

  /**
   * Instance method to add more texts to the vector store. This method optionally accepts pre-generated embeddings.
   * @param texts Iterable of strings/text to add to the vector store.
   * @param metadatas Optional list of metadata corresponding to each text.
   * @param embeddings Optional pre-generated embeddings for the texts.
   * @returns A Promise that resolves when texts are added successfully.
   */
  async addTexts(texts: string[], metadatas: object[] | object): Promise<void> {
    // Generate embeddings if not provided
    const embeddings = await this.embeddings.embedDocuments(texts);
    // console.log(embeddings)
    const client = this.connection;

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      // console.log(text)

      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      // console.log(metadata)
      // Serialize the 'metadata' object to a JSON string for inclusion in the SQL query
      const metadataJson = JSON.stringify(metadata);
      const embedding = embeddings[i].join(", "); // Convert embedding array to string representation

      // SQL query to insert the document, metadata, and embedding into the table
      const sqlStr = `INSERT INTO ${this.tableName} (${this.contentColumn}, ${this.metadataColumn}, ${this.vectorColumn}) VALUES (?, ?, TO_REAL_VECTOR(?));`;
      // console.log(sqlStr)

      await client.execute(sqlStr, [text, metadataJson, `[${embedding}]`]);
    }
  }

  similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"] | undefined
  ): Promise<[DocumentInterface<Record<string, any>>, number][]> {
    throw new Error("Method not implemented.");
  }
}
