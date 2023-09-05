import type { DataSource as DataSourceT, DataSourceOptions } from "typeorm";
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
import { Serializable } from "./load/serializable.js";

export { SqlDatabaseDataSourceParams, SqlDatabaseOptionsParams };

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

  sampleRowsInTableInfo = 3;

  customDescription?: Record<string, string>;

  protected constructor(fields: SqlDatabaseDataSourceParams) {
    super(...arguments);
    this.appDataSource = fields.appDataSource;
    this.appDataSourceOptions = fields.appDataSource.options;
    if (fields?.includesTables && fields?.ignoreTables) {
      throw new Error("Cannot specify both include_tables and ignoreTables");
    }
    this.includesTables = fields?.includesTables ?? [];
    this.ignoreTables = fields?.ignoreTables ?? [];
    this.sampleRowsInTableInfo =
      fields?.sampleRowsInTableInfo ?? this.sampleRowsInTableInfo;
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
   */
  async run(command: string, fetch: "all" | "one" = "all"): Promise<string> {
    // TODO: Potential security issue here
    const res = await this.appDataSource.query(command);

    if (fetch === "all") {
      return JSON.stringify(res);
    }

    if (res?.length > 0) {
      return JSON.stringify(res[0]);
    }

    return "";
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
