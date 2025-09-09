import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import {
  VectorStore,
  MaxMarginalRelevanceSearchOptions,
} from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
import { HanaInternalEmbeddings } from "../embeddings/hana_internal.js";
import {
  CONTAINS_OPERATOR,
  CreateWhereClause,
  DistanceStrategy,
  executeQuery,
  executeStatement,
  Filter,
  LOGICAL_OPERATORS_TO_SQL,
  prepareQuery,
  validateK,
  validateKAndFetchK,
} from "../utils/hanautils.js";

const HANA_DISTANCE_FUNCTION: Record<DistanceStrategy, [string, string]> = {
  COSINE: ["COSINE_SIMILARITY", "DESC"],
  EUCLIDEAN: ["L2DISTANCE", "ASC"],
};

const VECTOR_COLUMN_SQL_TYPES = ["REAL_VECTOR", "HALF_VECTOR"];

const INTERMEDIATE_TABLE_NAME = "intermediate_result";

const defaultDistanceStrategy = "COSINE";
const defaultTableName = "EMBEDDINGS";
const defaultContentColumn = "VEC_TEXT";
const defaultMetadataColumn = "VEC_META";
const defaultVectorColumn = "VEC_VECTOR";
const defaultVectorColumnLength = -1; // -1 means dynamic length
const defaultVectorColumnType = "REAL_VECTOR";

/**
 * Configuration options used to initialize a HanaDB instance.
 * 
 * @property connection               [required] An active SAP HANA database connection object.
 *                                    This should be a client or pool object compatible with the SAP HANA database driver.
 * 
 * @property distanceStrategy         [optional] The distance metric used for similarity search.
 *                                    Allowed Values: "COSINE" or "EUCLIDEAN".
 *                                    @default "COSINE"
 * 
 * @property tableName                [optional] Name of the table in the database that stores vector embeddings.
 *                                    @default "EMBEDDINGS"
 * 
 * @property contentColumn            [optional] Name of the column that stores the main text or content.
 *                                    @default "VEC_TEXT"
 * 
 * @property metadataColumn           [optional] Name of the column that stores metadata as a JSON string or object.
 *                                    @default "VEC_META"
 * 
 * @property vectorColumn             [optional] Name of the column that stores the embedding vector.
 *                                    @default "VEC_VECTOR"
 * 
 * @property vectorColumnLength       [optional] Specifies the length (dimensionality) of the vector column.
 *                                    If set to -1, the length is considered dynamic (i.e., not fixed).
 *                                    @default -1
 * 
 * @property vectorColumnType         [optional] The datatype of the vector column in the database.
 *                                    Typical values: "REAL_VECTOR" (32-bit floats), "HALF_VECTOR" (16-bit floats).
 *                                    @default "REAL_VECTOR"
 * 
 * @property specificMetadataColumns  [optional] An array of specific metadata column names to be extracted individually,
 *                                    instead of parsing from a single JSON metadata column.
 *                                    Useful when querying/filtering on individual metadata fields.
 *                                    @default undefined
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
  vectorColumnType?: string;
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

  private vectorColumnType: string;

  declare FilterType: Filter;

  private specificMetadataColumns: string[];

  private useInternalEmbeddings: boolean;

  private internalEmbeddingModelId: string;

  _vectorstoreType(): string {
    return "hanadb";
  }

  public getSpecificMetadataColumns(): string[] {
    return this.specificMetadataColumns;
  }

  public getMetadataColumn(): string {
    return this.metadataColumn;
  }

  /**
   * Extract metadata columns used with `$contains` in the filter.
   *
   * Scans the filter to find unspecific metadata columns used
   * with the `$contains` operator.
   *
   * @param filter - (Optional) A filter object that may include nested filter conditions.
   * @returns An array of unique metadata field names (as strings) that are used
   *          with the "$contains" operator.
   */
  private extractKeywordSearchColumns(filter?: this["FilterType"]): string[] {
    const keywordColumns = new Set<string>();
    this.recurseFiltersHelper(keywordColumns, filter);
    return [...keywordColumns];
  }

  private recurseFiltersHelper(
    keywordColumns: Set<string>,
    filterObj?: this["FilterType"],
    parentKey?: string
  ): void {
    if (!filterObj || typeof filterObj !== "object") return;

    Object.entries(filterObj).forEach(([key, value]) => {
      if (key === CONTAINS_OPERATOR) {
        if (
          parentKey &&
          parentKey !== this.contentColumn &&
          !this.specificMetadataColumns.includes(parentKey)
        ) {
          keywordColumns.add(parentKey);
        }
      } else if (key in LOGICAL_OPERATORS_TO_SQL) {
        // Assume it's an array of filters
        (value as this["FilterType"][]).forEach((subfilter) =>
          this.recurseFiltersHelper(keywordColumns, subfilter)
        );
      } else if (typeof value === "object" && value !== null) {
        this.recurseFiltersHelper(
          keywordColumns,
          value as this["FilterType"],
          key
        );
      }
    });
  }

  /**
   * Generate a SQL `WITH` clause to project metadata columns for keyword search.
   *
   *
   * Example:
   *       Input: ["title", "author"]
   *       Output:
   *       WITH intermediate_result AS (
   *           SELECT *,
   *           JSON_VALUE(metadata_column, '$.title') AS "title",
   *           JSON_VALUE(metadata_column, '$.author') AS "author"
   *           FROM "table_name"
   *       )
   *     *
   * @param projectedMetadataColumns - List of metadata column names for projection.
   * @returns A SQL `WITH` clause string.
   */
  private createMetadataProjection(projectedMetadataColumns: string[]): string {
    const metadataColumns = projectedMetadataColumns.map(
      (col) =>
        `JSON_VALUE(${this.metadataColumn}, '$.${HanaDB.sanitizeName(
          col
        )}') AS "${HanaDB.sanitizeName(col)}"`
    );
    return (
      `WITH ${INTERMEDIATE_TABLE_NAME} AS (` +
      `SELECT *, ${metadataColumns.join(", ")} ` +
      `FROM "${this.tableName}")`
    );
  }

  /**
   * Helper function to generate the SQL snippet for specific metadata columns.
   *
   * Returns a string in the format: ', "col1", "col2", ...'
   * if specific metadata columns are defined,
   * or an empty string if there are none.
   *
   * @returns A string representing the specific metadata columns for SQL insertion.
   */
  private getSpecificMetadataColumnsString(): string {
    if (this.specificMetadataColumns.length === 0) {
      return "";
    }
    return ', "' + this.specificMetadataColumns.join('", "') + '"';
  }

  /**
   * Splits the given metadata object into two parts:
   * 1. The original metadata (unchanged).
   * 2. An array of special metadata values corresponding to each column
   *    listed in `specificMetadataColumns`.
   *
   * @param metadata - The metadata object from which to extract special values.
   * @returns A tuple where the first element is the original metadata object,
   *          and the second element is an array of special metadata values.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private splitOffSpecialMetadata(metadata: any): [any, (string | null)[]] {
    const specialMetadata: (string | null)[] = [];
    if (!metadata) {
      return [{}, []];
    }
    for (const columnName of this.specificMetadataColumns) {
      specialMetadata.push(metadata[columnName] ?? null);
    }
    return [metadata, specialMetadata];
  }

  /**
   * Converts a standard 64-bit float (JS number) to a 16-bit half-precision float.
   * This is a necessary utility since Buffer doesn't have a native `writeHalfLE` method.
   *
   * This implementation is a common and well-established algorithm for the conversion.
   * @param value The number to convert.
   * @returns A 16-bit integer representing the half-precision float.
   */
  private floatToHalf(value: number): number {
    // Create a buffer and data view to work with the binary representation of the float
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);

    floatView[0] = value;
    const f32int = int32View[0];

    // Extract sign, exponent, and mantissa
    const sign = (f32int >> 16) & 0x8000;
    let exponent = ((f32int >> 23) & 0xff) - 127;
    let mantissa = f32int & 0x007fffff;

    if (exponent === 128) {
      // Infinity or NaN
      exponent = 15;
      mantissa = mantissa !== 0 ? 1 : 0;
    } else if (exponent > 15) {
      // Overflow
      exponent = 15;
      mantissa = 0;
    } else if (exponent < -14) {
      // Underflow
      exponent = 0;
      mantissa = 0;
    } else {
      exponent += 15;
      mantissa >>= 13;
    }

    return sign | (exponent << 10) | mantissa;
  }

  /**
   * Converts a 16-bit half-precision float to a 32-bit float (represented as a JS number).
   * @param half The 16-bit integer representing the half-precision float.
   * @returns The converted number.
   */
  private halfToFloat(half: number): number {
    const sign = (half >> 15) & 0x0001;
    const exponent = (half >> 10) & 0x001f;
    const mantissa = half & 0x03ff;
    if (exponent === 0) {
      if (mantissa === 0) return sign === 1 ? -0 : 0;
      return (sign === 1 ? -1 : 1) * 2 ** -14 * (mantissa / 1024);
    } else if (exponent === 31) {
      if (mantissa === 0) {
        return sign === 1 ? -Infinity : Infinity;
      }
      return NaN;
    }
    return (sign === 1 ? -1 : 1) * 2 ** (exponent - 15) * (1 + mantissa / 1024);
  }

  /**
   * Serializes a list of floats into a binary format based on the specified column type.
   * This function mimics the behavior of Python's `struct.pack`.
   *
   * @param values The list of floating-point numbers to serialize.
   * @param vectorColumnType The target binary format: "HALF_VECTOR" (2-byte floats) or "REAL_VECTOR" (4-byte floats).
   * @returns A Buffer containing the serialized binary data.
   */
  private serializeBinaryFormat(values: number[]): Buffer {
    if (this.vectorColumnType === "HALF_VECTOR") {
      // 2-byte half-precision float serialization
      // Total size = 4 bytes for length (UInt32) + 2 bytes for each float
      const bufferSize = 4 + values.length * 2;
      const buffer = Buffer.alloc(bufferSize);

      // Write the number of values as a 4-byte little-endian unsigned integer
      buffer.writeUInt32LE(values.length, 0);

      // Write each value as a 2-byte little-endian half-precision float
      let offset = 4;
      for (const value of values) {
        const halfFloat = this.floatToHalf(value);
        buffer.writeUInt16LE(halfFloat, offset);
        offset += 2;
      }
      return buffer;
    } else if (this.vectorColumnType === "REAL_VECTOR") {
      // 4-byte float serialization (standard FVECS format)
      // Total size = 4 bytes for length (UInt32) + 4 bytes for each float
      const bufferSize = 4 + values.length * 4;
      const buffer = Buffer.alloc(bufferSize);

      // Write the number of values as a 4-byte little-endian unsigned integer
      buffer.writeUInt32LE(values.length, 0);

      // Write each value as a 4-byte little-endian float
      let offset = 4;
      for (const value of values) {
        buffer.writeFloatLE(value, offset);
        offset += 4;
      }
      return buffer;
    } else {
      // This check is good practice, even with TypeScript types.
      throw new Error(
        `Unsupported vector column type: ${this.vectorColumnType}`
      );
    }
  }

  /**
   * Deserializes a binary Buffer back into a list of floats.
   * This is the inverse of `serializeBinaryFormat`.
   *
   * @param buffer The Buffer containing the binary data.
   * @param vectorColumnType The binary format used for serialization.
   * @returns An array of floating-point numbers.
   */
  private deserializeBinaryFormat(buffer: Buffer): number[] {
    // Guard against buffers that are too small to even contain a length value.
    if (buffer.length < 4) {
      throw new Error("Invalid buffer: too short to contain vector length.");
    }

    // Read the number of values from the first 4 bytes (Little Endian).
    const numValues = buffer.readUInt32LE(0);
    const values: number[] = [];

    if (this.vectorColumnType === "HALF_VECTOR") {
      const elementSize = 2; // 2 bytes for half-precision
      const expectedSize = 4 + numValues * elementSize;

      // Validate that the buffer is the correct size for the data it claims to hold.
      if (buffer.length < expectedSize) {
        throw new Error(
          `Invalid buffer: expected ${expectedSize} bytes for ${numValues} half-floats, but got ${buffer.length} bytes.`
        );
      }

      for (let i = 0; i < numValues; i += 1) {
        const offset = 4 + i * elementSize;
        // Read the 2-byte integer and convert it back to a float.
        const halfValue = buffer.readUInt16LE(offset);
        values.push(this.halfToFloat(halfValue));
      }
    } else if (this.vectorColumnType === "REAL_VECTOR") {
      const elementSize = 4; // 4 bytes for single-precision
      const expectedSize = 4 + numValues * elementSize;

      // Validate that the buffer is the correct size.
      if (buffer.length < expectedSize) {
        throw new Error(
          `Invalid buffer: expected ${expectedSize} bytes for ${numValues} floats, but got ${buffer.length} bytes.`
        );
      }

      for (let i = 0; i < numValues; i += 1) {
        const offset = 4 + i * elementSize;
        // Read the 4-byte float directly.
        values.push(buffer.readFloatLE(offset));
      }
    } else {
      throw new Error(
        `Unsupported vector column type: ${this.vectorColumnType}`
      );
    }

    return values;
  }

  /**
   * Generates query embedding using HANA's internal embedding engine.
   * @param query Query string to embed.
   */
  private async embedQueryHanaInternal(query: string): Promise<number[]> {
    let vectorEmbeddingSql = "VECTOR_EMBEDDING(?, 'QUERY', ?)";
    vectorEmbeddingSql =
      this.convertVectorEmbeddingToColumnType(vectorEmbeddingSql);

    const sqlParams = [query, this.internalEmbeddingModelId];
    const sqlStr = `SELECT ${vectorEmbeddingSql} AS EMBEDDING FROM sys.DUMMY;`;
    const stm = await prepareQuery(this.connection, sqlStr);
    const rows = await executeStatement(stm, sqlParams);
    return this.deserializeBinaryFormat(rows[0].EMBEDDING);
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
    this.vectorColumnType = HanaDB.sanitizeVectorColumnType(
      args.vectorColumnType || defaultVectorColumnType
    );
    this.specificMetadataColumns = HanaDB.sanitizeSpecificMetadataColumns(
      args.specificMetadataColumns || []
    );
    this.connection = args.connection;

    // Set the embedding and decide whether to use internal embedding
    this._setEmbeddings(embeddings);
  }

  /**
   * Use this method to change the embeddings instance.
   *
   * Sets the embedding instance and configures the internal embedding mode
   * if applicable.
   *
   * this method sets the internal flag and stores the model ID.
   * Otherwise, it ensures that external embedding mode is used.
   *
   * @param embeddings - An instance of EmbeddingsInterface.
   */
  private _setEmbeddings(embeddings: EmbeddingsInterface): void {
    this.embeddings = embeddings;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((embeddings as any).isHanaInternalEmbeddings === true) {
      this.useInternalEmbeddings = true;
      this.internalEmbeddingModelId = (
        embeddings as HanaInternalEmbeddings
      ).getModelId();
    } else {
      this.useInternalEmbeddings = false;
      this.internalEmbeddingModelId = "";
    }
  }

  /**
   * Ping the database to check if the in-database embedding
   * function exists and works.
   *
   * This method ensures that the internal VECTOR_EMBEDDING function
   * is available and functioning correctly by passing a test value.
   *
   * @throws Error if the internal embedding function validation fails.
   */
  private async validateInternalEmbeddingFunction(): Promise<void> {
    if (!this.internalEmbeddingModelId) {
      throw new Error("Internal embedding model id is not set");
    }
    const sqlStr =
      "SELECT COUNT(TO_NVARCHAR(VECTOR_EMBEDDING('test', 'QUERY', ?))) AS TEST FROM sys.DUMMY;";
    const client = this.connection;
    const stm = await prepareQuery(client, sqlStr);
    await executeStatement(stm, [this.internalEmbeddingModelId]);
  }

  public async initialize() {
    await HanaDB.validateDatatypeSupport(
      this.connection,
      this.vectorColumnType
    );

    if (this.useInternalEmbeddings)
      await this.validateInternalEmbeddingFunction();

    await this.initializeTable();
  }

  private async initializeTable() {
    const tableExists = await this.tableExists(this.tableName);
    if (!tableExists) {
      let sqlStr =
        `CREATE TABLE "${this.tableName}" (` +
        `"${this.contentColumn}" NCLOB, ` +
        `"${this.metadataColumn}" NCLOB, ` +
        `"${this.vectorColumn}" ${this.vectorColumnType}`;
      // Length can either be -1 (QRC01+02-24) or 0 (QRC03-24 onwards)
      if (this.vectorColumnLength === -1 || this.vectorColumnLength === 0) {
        sqlStr += ");";
      } else {
        sqlStr += `(${this.vectorColumnLength}));`;
      }

      const client = this.connection;
      await executeQuery(client, sqlStr);
    }

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
      [this.vectorColumnType],
      this.vectorColumnLength
    );

    for (const columnName of this.specificMetadataColumns) {
      await this.checkColumn(this.tableName, columnName);
    }
  }

  public async tableExists(tableName: string): Promise<boolean> {
    const tableExistsSQL = `SELECT COUNT(*) AS COUNT FROM SYS.TABLES WHERE SCHEMA_NAME = CURRENT_SCHEMA AND TABLE_NAME = ?`;
    const client = this.connection; // Get the connection object

    const stm = await prepareQuery(client, tableExistsSQL);
    const resultSet = await executeStatement(stm, [tableName]);
    if (resultSet[0].COUNT === 1) {
      // Table does  exist
      return true;
    }
    return false;
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
    columnType?: string | string[],
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
    const stm = await prepareQuery(client, sqlStr);
    // Execute the query with actual parameters to avoid SQL injection
    const resultSet = await executeStatement(stm, [tableName, columnName]);
    if (resultSet.length === 0) {
      throw new Error(`Column ${columnName} does not exist`);
    } else {
      const dataType: string = resultSet[0].DATA_TYPE_NAME;
      const length: number = resultSet[0].LENGTH;

      // Check if dataType is within columnType
      if (columnType) {
        const isValidType = Array.isArray(columnType)
          ? columnType.includes(dataType)
          : columnType === dataType;
        if (!isValidType) {
          throw new Error(
            `Column ${columnName} has the wrong type: ${dataType}`
          );
        }
      }

      // Length can either be -1 (QRC01+02-24) or 0 (QRC03-24 onwards)
      // to indicate no length constraint being present.

      // Check length, if parameter was provided
      if (columnLength !== undefined && length !== columnLength && length > 0) {
        throw new Error(`Column ${columnName} has the wrong length: ${length}`);
      }
    }
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
   * Sanitizes the input to integer. Throws an error if the value is less than lower bound.
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

  private static getMinSupportedVersion(datatype: string): string {
    if (datatype === "HALF_VECTOR") {
      return "2025.15 (QRC 2/2025)";
    } else if (datatype === "REAL_VECTOR") {
      return "2024.2 (QRC 1/2024)";
    } else {
      throw new Error(`Unknown datatype: ${datatype}`);
    }
  }

  private static async getInstanceVersion(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: any
  ): Promise<string | undefined> {
    const client = connection.client;
    try {
      const stm = await client.prepareQuery(
        "SELECT CLOUD_VERSION FROM SYS.M_DATABASE;"
      );
      const rows = await client.executeStatement(stm);
      return rows[0]?.CLOUD_VERSION;
    } catch (err) {
      return undefined;
    }
  }

  private static async getAvailableDatatypes(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: any
  ): Promise<Set<string>> {
    const client = connection;
    const rows = await executeQuery(
      client,
      "SELECT TYPE_NAME FROM SYS.DATA_TYPES"
    );
    if (rows.length === 0) {
      throw new Error("No data types returned by the database.");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const availableTypes = rows.map((row: any) => row.TYPE_NAME);
    return new Set<string>(availableTypes);
  }

  private static async validateDatatypeSupport(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: any,
    datatype: string
  ): Promise<boolean> {
    const availableDatatypes = await HanaDB.getAvailableDatatypes(connection);
    if (availableDatatypes.has(datatype)) {
      return true;
    }
    // Get instance version, but don't include it in error if retrieval fails
    let errorMessage = `${datatype} is not available on this HANA instance.\n`;

    //  Only include instance version line if it was successfully retrieved
    const instanceVersion = await HanaDB.getInstanceVersion(connection);
    if (instanceVersion) {
      errorMessage += `Instance version: ${instanceVersion}\n`;
    }
    const minInstanceVersion = HanaDB.getMinSupportedVersion(datatype);
    errorMessage += `Minimum required instance version: ${minInstanceVersion}`;

    throw new Error(errorMessage);
  }

  static sanitizeVectorColumnType(vectorColumnType: string): string {
    const vectorColumnTypeUpper = vectorColumnType.toUpperCase();
    if (!VECTOR_COLUMN_SQL_TYPES.includes(vectorColumnTypeUpper)) {
      throw new Error(`Invalid vector column type: ${vectorColumnType}.
        Must be one of ${VECTOR_COLUMN_SQL_TYPES.join(", ")}`);
    }
    return vectorColumnTypeUpper;
  }

  /**
   * Converts a vector expression to the target vector column type.
   *
   * Applies the appropriate vector conversion function
   * (TO_REAL_VECTOR or TO_HALF_VECTOR) to the provided
   * expression based on the configured vectorColumnType.
   *
   * @param expr - A vector expression.
   * @returns The expression wrapped with the appropriate conversion function.
   */
  private convertToTargetVectorType(expr: string): string {
    if (VECTOR_COLUMN_SQL_TYPES.includes(this.vectorColumnType)) {
      return `TO_${this.vectorColumnType}(${expr})`;
    }
    throw new Error(`Unsupported vector type: ${this.vectorColumnType}`);
  }

  /**
   * Ensures that an embedding produced by HANA's VECTOR_EMBEDDING
   * aligns with the target column type.
   *
   * Note: VECTOR_EMBEDDING always returns REAL_VECTORs.
   *
   * @param expr - SQL expression producing an embedding vector.
   * @returns The wrapped expression if the vector column type is not REAL_VECTOR,
   *          otherwise the original expression.
   */
  private convertVectorEmbeddingToColumnType(expr: string): string {
    if (!expr.toUpperCase().includes("VECTOR_EMBEDDING")) {
      throw new Error(`Expected 'VECTOR_EMBEDDING' in '${expr}'`);
    }

    if (this.vectorColumnType !== "REAL_VECTOR") {
      return this.convertToTargetVectorType(expr);
    }

    return expr;
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
    const { m, efConstruction, efSearch, indexName } = options;

    // Determine the distance function based on the configured strategy
    const distanceFuncName = HANA_DISTANCE_FUNCTION[this.distanceStrategy][0];
    const defaultIndexName = `${this.tableName}_${distanceFuncName}_idx`;

    // Use provided indexName or fallback to default
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
    await executeQuery(client, sqlStr);
  }

  /**
   * Adds an array of documents to the table.
   *
   *
   * In external embedding mode, this method computes embeddings client-side
   * and inserts them.
   * In internal embedding mode, it leverages the database's internal
   * VECTOR_EMBEDDING function to generate embeddings.
   *
   * @param documents Array of Document instances to be added to the table.
   * @returns Promise that resolves when the documents are added.
   */
  async addDocuments(documents: Document[]): Promise<void> {
    // If using internal embeddings, we do NOT call embedDocuments() from Node.
    if (this.useInternalEmbeddings) {
      return this.addDocumentsUsingInternalEmbedding(documents);
    }
    // Otherwise, default (external) approach:
    const texts = documents.map((doc) => doc.pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    return this.addVectors(vectors, documents);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sqlParams: [string, string, Buffer, ...any[]][] = texts.map(
      (text, i) => {
        const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
        const [remainingMetadata, specialMetadata] =
          this.splitOffSpecialMetadata(metadata);
        // Ensure embedding is generated or provided
        const serializedEmbedding = this.serializeBinaryFormat(vectors[i]);

        // Prepare the SQL parameters
        return [
          text,
          JSON.stringify(this.sanitizeMetadataKeys(remainingMetadata)),
          serializedEmbedding,
          ...specialMetadata,
        ];
      }
    );
    // Build the column list for the INSERT statement.
    const specificMetadataColumnsString =
      this.getSpecificMetadataColumnsString();
    const extraPlaceholders = this.specificMetadataColumns
      .map(() => ", ?")
      .join("");

    // Insert data into the table, bulk insert.
    const sqlStr = `INSERT INTO "${this.tableName}" ("${this.contentColumn}", "${this.metadataColumn}", "${this.vectorColumn}"${specificMetadataColumnsString})
                    VALUES (?, ?, ?${extraPlaceholders});`;
    const stm = await prepareQuery(client, sqlStr);
    await executeStatement(stm, sqlParams);
    // stm.execBatch(sqlParams);
  }

  /**
   * Adds documents to the database using the internal embedding function.
   *
   * This method constructs an SQL INSERT statement that leverages the
   * database's internal VECTOR_EMBEDDING function to generate embeddings
   * on the server side.
   *
   * @param documents - Array of Document objects to be added.
   * @returns Promise that resolves when the documents are added.
   */
  private async addDocumentsUsingInternalEmbedding(
    documents: Document[]
  ): Promise<void> {
    const texts = documents.map((doc) => doc.pageContent);
    const metadatas = documents.map((doc) => doc.metadata);
    const client = this.connection;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sqlParams: [string, string, string, string, ...(string | null)[]][] =
      texts.map((text, i) => {
        const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
        const [remainingMetadata, specialMetadata] =
          this.splitOffSpecialMetadata(metadata);
        // Prepare the SQL parameters
        return [
          text,
          JSON.stringify(this.sanitizeMetadataKeys(remainingMetadata)),
          text,
          this.internalEmbeddingModelId,
          ...specialMetadata,
        ];
      });
    // Build the column list for the INSERT statement.
    const specificMetadataColumnsString =
      this.getSpecificMetadataColumnsString();

    const embeddingExpr = "VECTOR_EMBEDDING(?, 'DOCUMENT', ?)";
    const vectorEmbeddingSql =
      this.convertVectorEmbeddingToColumnType(embeddingExpr);

    // Insert data into the table, bulk insert.
    const sqlStr = `INSERT INTO "${this.tableName}" ("${
      this.contentColumn
    }", "${this.metadataColumn}", "${
      this.vectorColumn
    }"${specificMetadataColumnsString})
                    VALUES (?, ?, ${vectorEmbeddingSql}${", ?".repeat(
      this.specificMetadataColumns.length
    )});`;
    const stm = await prepareQuery(client, sqlStr);
    await executeStatement(stm, sqlParams);
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
   * Deletes entries from the table based on the provided filter.
   * @param ids - Optional. Deletion by ids is not supported and will throw an error.
   * @param filter - Optional. A filter object to specify which entries to delete.
   * @throws Error if 'ids' parameter is provided, as deletion by ids is not supported.
   * @throws Error if 'filter' parameter is not provided, as it is required for deletion.
   */
  async delete(options: { ids?: string[]; filter?: Filter }): Promise<void> {
    const { ids, filter } = options;
    if (ids) {
      throw new Error("Deletion via IDs is not supported");
    }
    if (!filter) {
      throw new Error("Parameter 'filter' is required when calling 'delete'");
    }

    const [whereStr, queryTuple] = new CreateWhereClause(this).build(filter);
    const sqlStr = `DELETE FROM "${this.tableName}" ${whereStr}`;
    const client = this.connection;
    const stm = await prepareQuery(client, sqlStr);
    await executeStatement(stm, queryTuple);
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
    filter?: this["FilterType"]
  ): Promise<Document[]> {
    const results = await this.similaritySearchWithScore(query, k, filter);
    return results.map((result) => result[0]);
  }

  // Equivalent to similarity_search_with_vector in the Python API
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
    filter?: this["FilterType"]
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
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    let wholeResult = null;
    if (this.useInternalEmbeddings) {
      // Internal embeddings: pass the query directly
      wholeResult = await this.similaritySearchWithScoreAndVectorByQuery(
        query,
        k,
        filter
      );
    } else {
      const queryEmbedding = await this.embeddings.embedQuery(query);
      // External embeddings: generate embedding from the query
      wholeResult = await this.similaritySearchWithScoreAndVectorByVector(
        queryEmbedding,
        k,
        filter
      );
    }
    return wholeResult.map(([doc, score]) => [doc, score]);
  }

  /**
   * Performs a similarity search based on vector comparison and returns documents along with their similarity scores and vectors.
   * @param embedding The vector representation of the query for similarity comparison.
   * @param k The number of top similar documents to return. Defaults to 4.
   * @param filter Optional filter criteria to apply to the search query.
   * @returns A promise that resolves to an array of tuples, each containing a Document, its similarity score, and its vector.
   */
  async similaritySearchWithScoreAndVectorByVector(
    embedding: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<Array<[Document, number, number[]]>> {
    // Convert the embedding vector to a string for SQL query
    const sanitizedEmbedding = HanaDB.sanitizeListFloat(embedding);
    const embeddingString = `'[${sanitizedEmbedding.join(", ")}]'`;
    const embeddingExpr = this.convertToTargetVectorType(embeddingString);
    return this.similaritySearchWithScoreAndVector(embeddingExpr, k, filter);
  }

  /**
   * Performs a similarity search using the internal embedding function.
   *
   * In this mode, the query text is passed directly to the database's internal VECTOR_EMBEDDING function.
   *
   * @param query - The query text.
   * @param k - The number of documents to return. Defaults to 4.
   * @param filter A dictionary of metadata fields and values to filter by.
                  Defaults to None.
   * @returns A promise that resolves to an array of tuples, each containing a Document, its similarity score, and its vector.
   * @throws Error if internal embedding mode is not active.
   */
  async similaritySearchWithScoreAndVectorByQuery(
    query: string,
    k: number,
    filter?: this["FilterType"]
  ): Promise<Array<[Document, number, number[]]>> {
    if (!this.useInternalEmbeddings) {
      throw new Error(
        "Internal embedding search requires an internal embedding instance."
      );
    }
    const embeddingExpr = "VECTOR_EMBEDDING(?, 'QUERY', ?)";
    const vectorEmbeddingSql =
      this.convertVectorEmbeddingToColumnType(embeddingExpr);

    const vectorEmbeddingParams = [query, this.internalEmbeddingModelId];
    return this.similaritySearchWithScoreAndVector(
      vectorEmbeddingSql,
      k,
      filter,
      vectorEmbeddingParams
    );
  }

  /**
   * Performs a similarity search using the provided embedding expression.
   *
   * This helper method is used by both external and internal similarity search methods
   * to construct and execute the SQL query.
   *
   * @param embeddingExpr - SQL expression that represents or generates the query embedding.
   * @param k - The number of documents to return. Defaults to 4.
   * @param filter A dictionary of metadata fields and values to filter by.
                  Defaults to None.
   * @param vectorEmbeddingParams - Optional parameters for the embedding expression (used in internal mode).
   * @returns Promise that resolves to a list of documents and their corresponding similarity scores.
   */
  private async similaritySearchWithScoreAndVector(
    embeddingExpr: string,
    k: number,
    filter?: this["FilterType"],
    vectorEmbeddingParams?: string[]
  ): Promise<Array<[Document, number, number[]]>> {
    validateK(k);

    // Determine the distance function based on the configured strategy
    const distanceFuncName = HANA_DISTANCE_FUNCTION[this.distanceStrategy][0];

    // Keyword search: extract metadata columns used with $contains
    const projectedMetadataColumns = this.extractKeywordSearchColumns(filter);
    let metadataProjection = "";
    let fromClause = `"${this.tableName}"`;
    if (projectedMetadataColumns.length > 0) {
      metadataProjection = this.createMetadataProjection(
        projectedMetadataColumns
      );
      fromClause = INTERMEDIATE_TABLE_NAME;
    }

    let sqlStr = `${metadataProjection}
                    SELECT TOP ${k}
                    "${this.contentColumn}", 
                    "${this.metadataColumn}", 
                    "${this.vectorColumn}" AS VECTOR, 
                    ${distanceFuncName}("${this.vectorColumn}", ${embeddingExpr}) AS CS
                    FROM ${fromClause}`;
    // Add order by clause to sort by similarity
    const orderStr = ` ORDER BY CS ${
      HANA_DISTANCE_FUNCTION[this.distanceStrategy][1]
    }`;

    // Prepare and execute the SQL query
    const queryTuple: string[] = [];
    if (vectorEmbeddingParams && vectorEmbeddingParams.length > 0) {
      queryTuple.push(...vectorEmbeddingParams);
    }
    const [whereStr, whereParams] = new CreateWhereClause(this).build(filter);
    if (whereStr) {
      sqlStr += ` ${whereStr}`;
      queryTuple.push(...whereParams);
    }

    sqlStr += orderStr;
    const client = this.connection;
    const stm = await prepareQuery(client, sqlStr);
    const resultSet = await executeStatement(stm, queryTuple);
    const result: Array<[Document, number, number[]]> = resultSet.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row: any) => {
        const metadata = JSON.parse(row[this.metadataColumn].toString("utf8"));
        const doc: Document = {
          pageContent: row[this.contentColumn].toString("utf8"),
          metadata,
        };
        const resultVector = this.deserializeBinaryFormat(row.VECTOR);
        const score = row.CS;
        return [doc, score, resultVector];
      }
    );

    return result;
  }

  /**
   * Return documents selected using the maximal marginal relevance.
   *
   * Maximal marginal relevance optimizes for similarity to the query AND
   * diversity among selected documents.
   *
   * When using an internal embedding instance, the query is processed
   * directly by the database's internal embedding function.
   * Otherwise, the query is embedded externally.
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
    const { k, fetchK = 20, lambda = 0.5, filter } = options;

    validateKAndFetchK(k, fetchK);

    let queryEmbedding: number[];
    if (!this.useInternalEmbeddings) {
      queryEmbedding = await this.embeddings.embedQuery(query);
    } else {
      queryEmbedding = await this.embedQueryHanaInternal(query);
    }

    const docs = await this.similaritySearchWithScoreAndVectorByVector(
      queryEmbedding,
      fetchK,
      filter
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
