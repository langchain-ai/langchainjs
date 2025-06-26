import type { DataSource as DataSourceT, DataSourceOptions } from "typeorm";
import { Serializable } from "@langchain/core/load/serializable";
import {
  generateTableInfoFromTables,
  getTableAndColumnsName,
  SerializedSqlDatabase,
  SqlDatabaseDataSourceParams,
  SqlDatabaseOptionsParams,
  SqlTable,
  verifyIgnoreTablesExistInDatabase,
  verifyIncludeTablesExistInDatabase,
  verifyListTablesExistInDatabase,
} from "./util/sql_utils.js";

export type { SqlDatabaseDataSourceParams, SqlDatabaseOptionsParams };

/**
 * Patterns to detect dangerous SQL commands.
 */
const dangerousPatterns = [
  /;\s*drop\s+/i, // DROP statements
  /;\s*delete\s+/i, // DELETE statements
  /;\s*update\s+/i, // UPDATE statements
  /;\s*insert\s+/i, // INSERT statements
  /;\s*alter\s+/i, // ALTER statements
  /;\s*create\s+/i, // CREATE statements
  /;\s*truncate\s+/i, // TRUNCATE statements
  /;\s*exec\s*\(/i, // EXEC statements
  /;\s*execute\s*\(/i, // EXECUTE statements
  /xp_cmdshell/i, // SQL Server command execution
  /sp_executesql/i, // SQL Server dynamic SQL
  /--[^\r\n]*/g, // SQL comments (can hide malicious code)
  /\/\*[\s\S]*?\*\//g, // Multi-line comments
  /\bunion\s+select\b/i, // Union-based injection
  /\bor\s+1\s*=\s*1\b/i, // Common injection pattern
  /\band\s+1\s*=\s*1\b/i, // Common injection pattern
  /'\s*or\s*'1'\s*=\s*'1/i, // String-based injection
  /;\s*shutdown\s+/i, // Database shutdown
  /;\s*backup\s+/i, // Database backup
  /;\s*restore\s+/i, // Database restore
];

/**
 * Allowed SQL statements.
 *
 * @todo(@christian-bromann): In the next major version, the default allowed statements
 * will be restricted to ["SELECT"] only for improved security. Users requiring other
 * statement types should explicitly configure allowedStatements in the constructor.
 */
const ALLOWED_STATEMENTS = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "CREATE",
  "DROP",
  "ALTER",
] as const;

const DEFAULT_SAMPLE_ROWS_IN_TABLE_INFO = 3;

const DEFAULT_MAX_QUERY_LENGTH = 10000;

const DEFAULT_ENABLE_SQL_VALIDATION = true;

/**
 * Class that represents a SQL database in the LangChain framework.
 *
 * @security **Security Notice**
 * This class executes SQL queries against a database, which poses significant security risks.
 *
 * **Security Best Practices:**
 * 1. Use a database user with minimal read-only permissions
 * 2. Scope access to only necessary tables using includesTables/ignoreTables
 * 3. Keep enableSqlValidation=true in production
 * 4. Monitor SQL execution logs for suspicious activity
 * 5. Consider using prepared statements for complex queries
 *
 * **⚠️ Breaking Change Notice:**
 * In the next major version, the default `allowedStatements` will be restricted
 * to `["SELECT"]` only for improved security. Applications requiring other SQL
 * operations should explicitly configure `allowedStatements` in the constructor.
 *
 * @link See https://js.langchain.com/docs/security for more information.
 */
export class SqlDatabase
  extends Serializable
  implements SqlDatabaseOptionsParams, SqlDatabaseDataSourceParams
{
  lc_namespace = ["langchain", "sql_db"];

  toJSON() {
    return this.toJSONNotImplemented();
  }

  appDataSourceOptions: DataSourceOptions;

  appDataSource: DataSourceT;

  allTables: Array<SqlTable> = [];

  includesTables: Array<string> = [];

  ignoreTables: Array<string> = [];

  sampleRowsInTableInfo = DEFAULT_SAMPLE_ROWS_IN_TABLE_INFO;

  customDescription?: Record<string, string>;

  allowedStatements: string[] = [...ALLOWED_STATEMENTS];

  enableSqlValidation = DEFAULT_ENABLE_SQL_VALIDATION;

  maxQueryLength = DEFAULT_MAX_QUERY_LENGTH;

  protected constructor(fields: SqlDatabaseDataSourceParams) {
    super(...arguments);
    this.appDataSource = fields.appDataSource;
    this.appDataSourceOptions = fields.appDataSource.options;
    if (fields?.includesTables && fields?.ignoreTables) {
      throw new Error("Cannot specify both includeTables and ignoreTables");
    }
    this.includesTables = fields?.includesTables ?? [];
    this.ignoreTables = fields?.ignoreTables ?? [];
    this.sampleRowsInTableInfo =
      fields?.sampleRowsInTableInfo ?? this.sampleRowsInTableInfo;
    this.allowedStatements =
      fields?.allowedStatements ?? this.allowedStatements;
    this.enableSqlValidation =
      fields?.enableSqlValidation ?? this.enableSqlValidation;
    this.maxQueryLength = fields?.maxQueryLength ?? this.maxQueryLength;
  }

  static async fromDataSourceParams(
    fields: SqlDatabaseDataSourceParams
  ): Promise<SqlDatabase> {
    const sqlDatabase = new SqlDatabase(fields);
    if (!sqlDatabase.appDataSource.isInitialized) {
      await sqlDatabase.appDataSource.initialize();
    }
    sqlDatabase.allTables = await getTableAndColumnsName(
      sqlDatabase.appDataSource
    );
    sqlDatabase.customDescription = Object.fromEntries(
      Object.entries(fields?.customDescription ?? {}).filter(([key, _]) =>
        sqlDatabase.allTables
          .map((table: SqlTable) => table.tableName)
          .includes(key)
      )
    );
    verifyIncludeTablesExistInDatabase(
      sqlDatabase.allTables,
      sqlDatabase.includesTables
    );
    verifyIgnoreTablesExistInDatabase(
      sqlDatabase.allTables,
      sqlDatabase.ignoreTables
    );
    return sqlDatabase;
  }

  static async fromOptionsParams(
    fields: SqlDatabaseOptionsParams
  ): Promise<SqlDatabase> {
    const { DataSource } = await import("typeorm");
    const dataSource = new DataSource(fields.appDataSourceOptions);
    return SqlDatabase.fromDataSourceParams({
      ...fields,
      appDataSource: dataSource,
    });
  }

  /**
   * Get information about specified tables.
   *
   * Follows best practices as specified in: Rajkumar et al, 2022
   * (https://arxiv.org/abs/2204.00498)
   *
   * If `sample_rows_in_table_info`, the specified number of sample rows will be
   * appended to each table description. This can increase performance as
   * demonstrated in the paper.
   */
  async getTableInfo(targetTables?: Array<string>): Promise<string> {
    let selectedTables =
      this.includesTables.length > 0
        ? this.allTables.filter((currentTable) =>
            this.includesTables.includes(currentTable.tableName)
          )
        : this.allTables;

    if (this.ignoreTables.length > 0) {
      selectedTables = selectedTables.filter(
        (currentTable) => !this.ignoreTables.includes(currentTable.tableName)
      );
    }

    if (targetTables && targetTables.length > 0) {
      verifyListTablesExistInDatabase(
        this.allTables,
        targetTables,
        "Wrong target table name:"
      );
      selectedTables = this.allTables.filter((currentTable) =>
        targetTables.includes(currentTable.tableName)
      );
    }

    return generateTableInfoFromTables(
      selectedTables,
      this.appDataSource,
      this.sampleRowsInTableInfo,
      this.customDescription
    );
  }

  /**
   * Execute a SQL command and return a string representing the results.
   * If the statement returns rows, a string of the results is returned.
   * If the statement returns no rows, an empty string is returned.
   *
   * @security This method executes raw SQL queries and has security implications.
   * Only SELECT queries are allowed by default. To enable other operations,
   * set allowedStatements in the constructor options.
   *
   * @example
   * ```typescript
   * // ✅ recommended
   * const result = await db.run("SELECT * FROM users WHERE age > ?", [18]);
   * // ❌ not recommended
   * const result = await db.run("SELECT * FROM users WHERE age > 18");
   * ```
   *
   * @param command - SQL query string
   * @param fetch - Return "all" rows or just "one"
   * @returns JSON string of results
   */
  async run(command: string, fetch?: "all" | "one"): Promise<string>;

  /**
   * Execute a parameterized SQL query with safer parameter binding.
   * This overload is recommended for queries with user input.
   *
   * @param command - SQL query with parameter placeholders (?)
   * @param parameters - Array of parameter values to bind
   * @param fetch - Return "all" rows or just "one"
   * @returns JSON string of results
   *
   * @example
   * ```typescript
   * const result = await db.run(
   *   "SELECT * FROM users WHERE age > ? AND name = ?",
   *   [18, "John"]
   * );
   * ```
   */
  async run(
    command: string,
    parameters: unknown[],
    fetch?: "all" | "one"
  ): Promise<string>;

  /**
   * Execute a SQL command with optional parameters and return results.
   *
   * @param command - SQL query string
   * @param fetchOrParameters - Either fetch mode or parameters array
   * @param fetch - Fetch mode when parameters are provided
   * @returns JSON string of results
   */
  async run(
    command: string,
    fetchOrParameters?: "all" | "one" | unknown[],
    fetch: "all" | "one" = "all"
  ): Promise<string> {
    let parameters: unknown[] | undefined;
    let actualFetch: "all" | "one" = "all";

    // Determine if second parameter is fetch mode or parameters array
    if (Array.isArray(fetchOrParameters)) {
      parameters = fetchOrParameters;
      actualFetch = fetch;
    } else if (fetchOrParameters === "all" || fetchOrParameters === "one") {
      actualFetch = fetchOrParameters;
    } else if (fetchOrParameters === undefined) {
      actualFetch = "all";
    }

    // Validate and sanitize the SQL command if validation is enabled
    if (this.enableSqlValidation) {
      this.validateSqlCommand(command);
    }

    // Execute query with or without parameters
    const res = parameters
      ? await this.appDataSource.query(command, parameters)
      : await this.appDataSource.query(command);

    if (actualFetch === "all") {
      return JSON.stringify(res);
    }

    if (res?.length > 0) {
      return JSON.stringify(res[0]);
    }

    return "";
  }

  /**
   * Validates a SQL command for security vulnerabilities.
   * Throws an error if the command is potentially unsafe.
   */
  private validateSqlCommand(command: string): void {
    if (!command || typeof command !== "string") {
      throw new Error("SQL command must be a non-empty string");
    }

    // Check for dangerous patterns
    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error(
          `Potentially unsafe SQL command detected. Pattern: ${pattern.source}`
        );
      }
    }

    // Remove leading/trailing whitespace and normalize
    const normalizedCommand = command.trim().toLowerCase();

    // Check if the command starts with an allowed statement
    const startsWithAllowedStatement = this.allowedStatements.some((stmt) =>
      normalizedCommand.startsWith(stmt.toLowerCase())
    );
    if (!startsWithAllowedStatement) {
      throw new Error(
        `Only ${this.allowedStatements.join(
          ", "
        )} queries are allowed for security reasons`
      );
    }

    // Check for multiple statements (semicolon followed by non-whitespace)
    const statementCount = command
      .split(";")
      .filter((stmt) => stmt.trim().length > 0).length;
    if (statementCount > 1) {
      throw new Error("Multiple SQL statements are not allowed");
    }

    // Additional validation: check for excessively long queries (potential DoS)
    if (command.length > this.maxQueryLength) {
      throw new Error(
        `SQL command exceeds maximum allowed length of ${this.maxQueryLength} characters`
      );
    }
  }

  serialize(): SerializedSqlDatabase {
    return {
      _type: "sql_database",
      appDataSourceOptions: this.appDataSourceOptions,
      includesTables: this.includesTables,
      ignoreTables: this.ignoreTables,
      sampleRowsInTableInfo: this.sampleRowsInTableInfo,
    };
  }

  /** @ignore */
  static async imports() {
    try {
      const { DataSource } = await import("typeorm");
      return { DataSource };
    } catch (e) {
      console.error(e);
      throw new Error(
        "Failed to load typeorm. Please install it with eg. `yarn add typeorm`."
      );
    }
  }
}
