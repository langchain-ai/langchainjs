import type { DataSource, DataSourceOptions } from "typeorm";
import type { PromptTemplate } from "@langchain/core/prompts";
import {
  DEFAULT_SQL_DATABASE_PROMPT,
  SQL_SAP_HANA_PROMPT,
  SQL_MSSQL_PROMPT,
  SQL_MYSQL_PROMPT,
  SQL_POSTGRES_PROMPT,
  SQL_SQLITE_PROMPT,
  SQL_ORACLE_PROMPT,
} from "../chains/sql_db/sql_db_prompt.js";

interface RawResultTableAndColumn {
  table_name: string;
  column_name: string;
  data_type: string | undefined;
  is_nullable: string;
}

export interface SqlDatabaseParams {
  includesTables?: Array<string>;
  ignoreTables?: Array<string>;
  sampleRowsInTableInfo?: number;
  customDescription?: Record<string, string>;
}

export interface SqlDatabaseOptionsParams extends SqlDatabaseParams {
  appDataSourceOptions: DataSourceOptions;
}

export interface SqlDatabaseDataSourceParams extends SqlDatabaseParams {
  appDataSource: DataSource;
}

export type SerializedSqlDatabase = SqlDatabaseOptionsParams & {
  _type: string;
};

export interface SqlTable {
  tableName: string;
  columns: SqlColumn[];
}

export interface SqlColumn {
  columnName: string;
  dataType?: string;
  isNullable?: boolean;
}

export const verifyListTablesExistInDatabase = (
  tablesFromDatabase: Array<SqlTable>,
  listTables: Array<string>,
  errorPrefixMsg: string
): void => {
  const onlyTableNames: Array<string> = tablesFromDatabase.map(
    (table: SqlTable) => table.tableName
  );
  if (listTables.length > 0) {
    for (const tableName of listTables) {
      if (!onlyTableNames.includes(tableName)) {
        throw new Error(
          `${errorPrefixMsg} the table ${tableName} was not found in the database`
        );
      }
    }
  }
};

export const verifyIncludeTablesExistInDatabase = (
  tablesFromDatabase: Array<SqlTable>,
  includeTables: Array<string>
): void => {
  verifyListTablesExistInDatabase(
    tablesFromDatabase,
    includeTables,
    "Include tables not found in database:"
  );
};

export const verifyIgnoreTablesExistInDatabase = (
  tablesFromDatabase: Array<SqlTable>,
  ignoreTables: Array<string>
): void => {
  verifyListTablesExistInDatabase(
    tablesFromDatabase,
    ignoreTables,
    "Ignore tables not found in database:"
  );
};

const formatToSqlTable = (
  rawResultsTableAndColumn: Array<RawResultTableAndColumn>
): Array<SqlTable> => {
  const sqlTable: Array<SqlTable> = [];
  for (const oneResult of rawResultsTableAndColumn) {
    const sqlColumn = {
      columnName: oneResult.column_name,
      dataType: oneResult.data_type,
      isNullable: oneResult.is_nullable === "YES",
    };
    const currentTable = sqlTable.find(
      (oneTable) => oneTable.tableName === oneResult.table_name
    );
    if (currentTable) {
      currentTable.columns.push(sqlColumn);
    } else {
      const newTable = {
        tableName: oneResult.table_name,
        columns: [sqlColumn],
      };
      sqlTable.push(newTable);
    }
  }

  return sqlTable;
};

export const getTableAndColumnsName = async (
  appDataSource: DataSource
): Promise<Array<SqlTable>> => {
  let sql;
  if (
    appDataSource.options.type === "postgres" ||
    appDataSource.options.type === "aurora-postgres"
  ) {
    const schema =
      appDataSource.options.type === "postgres"
        ? (appDataSource.options?.schema ?? "public")
        : "public";
    sql = `SELECT 
            t.table_name, 
            c.* 
          FROM 
            information_schema.tables t 
              JOIN information_schema.columns c 
                ON t.table_name = c.table_name 
          WHERE 
            t.table_schema = '${schema}' 
              AND c.table_schema = '${schema}' 
          ORDER BY 
            t.table_name,
            c.ordinal_position;`;
    const rep = await appDataSource.query(sql);

    return formatToSqlTable(rep);
  }

  if (
    appDataSource.options.type === "sqlite" ||
    appDataSource.options.type === "better-sqlite3" ||
    appDataSource.options.type === "sqljs"
  ) {
    sql =
      "SELECT \n" +
      "   m.name AS table_name,\n" +
      "   p.name AS column_name,\n" +
      "   p.type AS data_type,\n" +
      "   CASE \n" +
      "      WHEN p.\"notnull\" = 0 THEN 'YES' \n" +
      "      ELSE 'NO' \n" +
      "   END AS is_nullable \n" +
      "FROM \n" +
      "   sqlite_master m \n" +
      "JOIN \n" +
      "   pragma_table_info(m.name) p \n" +
      "WHERE \n" +
      "   m.type = 'table' AND \n" +
      "   m.name NOT LIKE 'sqlite_%';\n";

    const rep = await appDataSource.query(sql);

    return formatToSqlTable(rep);
  }

  if (
    appDataSource.options.type === "mysql" ||
    appDataSource.options.type === "aurora-mysql"
  ) {
    sql =
      "SELECT " +
      "TABLE_NAME AS table_name, " +
      "COLUMN_NAME AS column_name, " +
      "DATA_TYPE AS data_type, " +
      "IS_NULLABLE AS is_nullable " +
      "FROM INFORMATION_SCHEMA.COLUMNS " +
      `WHERE TABLE_SCHEMA = '${appDataSource.options.database}';`;

    const rep = await appDataSource.query(sql);

    return formatToSqlTable(rep);
  }

  if (appDataSource.options.type === "mssql") {
    const schema = appDataSource.options?.schema;
    const sql = `SELECT
    TABLE_NAME AS table_name,
    COLUMN_NAME AS column_name,
    DATA_TYPE AS data_type,
    IS_NULLABLE AS is_nullable
    FROM INFORMATION_SCHEMA.COLUMNS
    ${schema && `WHERE TABLE_SCHEMA = '${schema}'`} 
ORDER BY TABLE_NAME, ORDINAL_POSITION;`;

    const rep = await appDataSource.query(sql);
    return formatToSqlTable(rep);
  }

  if (appDataSource.options.type === "sap") {
    const schema = appDataSource.options?.schema ?? "public";
    sql = `SELECT
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE_NAME AS data_type,
        CASE WHEN IS_NULLABLE='TRUE' THEN 'YES' ELSE 'NO' END AS is_nullable
      FROM TABLE_COLUMNS
      WHERE SCHEMA_NAME='${schema}'`;

    const rep: Array<{ [key: string]: string }> =
      await appDataSource.query(sql);

    const repLowerCase: Array<RawResultTableAndColumn> = [];
    rep.forEach((_rep) =>
      repLowerCase.push({
        table_name: _rep.TABLE_NAME,
        column_name: _rep.COLUMN_NAME,
        data_type: _rep.DATA_TYPE,
        is_nullable: _rep.IS_NULLABLE,
      })
    );

    return formatToSqlTable(repLowerCase);
  }
  if (appDataSource.options.type === "oracle") {
    const schemaName = appDataSource.options.schema;
    const sql = `  
      SELECT
          TABLE_NAME AS "table_name",
          COLUMN_NAME AS "column_name",
          DATA_TYPE AS "data_type",
          NULLABLE AS "is_nullable"
      FROM ALL_TAB_COLS
      WHERE
          OWNER = UPPER('${schemaName}')`;
    const rep = await appDataSource.query(sql);
    return formatToSqlTable(rep);
  }
  throw new Error("Database type not implemented yet");
};

const formatSqlResponseToSimpleTableString = (rawResult: unknown): string => {
  if (!rawResult || !Array.isArray(rawResult) || rawResult.length === 0) {
    return "";
  }

  let globalString = "";
  for (const oneRow of rawResult) {
    globalString += `${Object.values(oneRow).reduce(
      (completeString, columnValue) => `${completeString} ${columnValue}`,
      ""
    )}\n`;
  }

  return globalString;
};

export const generateTableInfoFromTables = async (
  tables: Array<SqlTable> | undefined,
  appDataSource: DataSource,
  nbSampleRow: number,
  customDescription?: Record<string, string>
): Promise<string> => {
  if (!tables) {
    return "";
  }

  let globalString = "";
  for (const currentTable of tables) {
    // Add the custom info of the table
    const tableCustomDescription =
      customDescription &&
      Object.keys(customDescription).includes(currentTable.tableName)
        ? `${customDescription[currentTable.tableName]}\n`
        : "";
    // Add the creation of the table in SQL
    let schema = null;
    if (appDataSource.options.type === "postgres") {
      schema = appDataSource.options?.schema ?? "public";
    } else if (appDataSource.options.type === "aurora-postgres") {
      schema = "public";
    } else if (appDataSource.options.type === "mssql") {
      schema = appDataSource.options?.schema;
    } else if (appDataSource.options.type === "sap") {
      schema =
        appDataSource.options?.schema ??
        appDataSource.options?.username ??
        "public";
    } else if (appDataSource.options.type === "oracle") {
      schema = appDataSource.options.schema;
    }
    let sqlCreateTableQuery = schema
      ? `CREATE TABLE "${schema}"."${currentTable.tableName}" (\n`
      : `CREATE TABLE ${currentTable.tableName} (\n`;
    for (const [key, currentColumn] of currentTable.columns.entries()) {
      if (key > 0) {
        sqlCreateTableQuery += ", ";
      }
      sqlCreateTableQuery += `${currentColumn.columnName} ${
        currentColumn.dataType
      } ${currentColumn.isNullable ? "" : "NOT NULL"}`;
    }
    sqlCreateTableQuery += ") \n";

    let sqlSelectInfoQuery;
    if (appDataSource.options.type === "mysql") {
      // We use backticks to quote the table names and thus allow for example spaces in table names
      sqlSelectInfoQuery = `SELECT * FROM \`${currentTable.tableName}\` LIMIT ${nbSampleRow};\n`;
    } else if (appDataSource.options.type === "postgres") {
      const schema =
        appDataSource.options.type === "postgres"
          ? (appDataSource.options?.schema ?? "public")
          : "public";
      sqlSelectInfoQuery = `SELECT * FROM "${schema}"."${currentTable.tableName}" LIMIT ${nbSampleRow};\n`;
    } else if (appDataSource.options.type === "mssql") {
      const schema = appDataSource.options?.schema;
      sqlSelectInfoQuery = schema
        ? `SELECT TOP ${nbSampleRow} * FROM ${schema}.[${currentTable.tableName}];\n`
        : `SELECT TOP ${nbSampleRow} * FROM [${currentTable.tableName}];\n`;
    } else if (appDataSource.options.type === "sap") {
      const schema =
        appDataSource.options?.schema ??
        appDataSource.options?.username ??
        "public";
      sqlSelectInfoQuery = `SELECT * FROM "${schema}"."${currentTable.tableName}" LIMIT ${nbSampleRow};\n`;
    } else if (appDataSource.options.type === "oracle") {
      sqlSelectInfoQuery = `SELECT * FROM "${schema}"."${currentTable.tableName}" WHERE ROWNUM <= '${nbSampleRow}'`;
    } else {
      sqlSelectInfoQuery = `SELECT * FROM "${currentTable.tableName}" LIMIT ${nbSampleRow};\n`;
    }

    const columnNamesConcatString = `${currentTable.columns.reduce(
      (completeString, column) => `${completeString} ${column.columnName}`,
      ""
    )}\n`;

    let sample = "";
    try {
      const infoObjectResult = nbSampleRow
        ? await appDataSource.query(sqlSelectInfoQuery)
        : null;
      sample = formatSqlResponseToSimpleTableString(infoObjectResult);
    } catch (error) {
      // If the request fails we catch it and only display a log message
      console.log(error);
    }

    globalString = globalString.concat(
      tableCustomDescription +
        sqlCreateTableQuery +
        sqlSelectInfoQuery +
        columnNamesConcatString +
        sample
    );
  }

  return globalString;
};

export const getPromptTemplateFromDataSource = (
  appDataSource: DataSource
): PromptTemplate => {
  if (
    appDataSource.options.type === "postgres" ||
    appDataSource.options.type === "aurora-postgres"
  ) {
    return SQL_POSTGRES_PROMPT;
  }

  if (appDataSource.options.type === "sqlite") {
    return SQL_SQLITE_PROMPT;
  }

  if (appDataSource.options.type === "mysql") {
    return SQL_MYSQL_PROMPT;
  }

  if (appDataSource.options.type === "mssql") {
    return SQL_MSSQL_PROMPT;
  }

  if (appDataSource.options.type === "sap") {
    return SQL_SAP_HANA_PROMPT;
  }

  if (appDataSource.options.type === "oracle") {
    return SQL_ORACLE_PROMPT;
  }

  return DEFAULT_SQL_DATABASE_PROMPT;
};
