import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import PostgresEngine from "./engine.js";
import {
  textFormatter,
  csvFormatter,
  yamlFormatter,
  jsonFormatter,
} from "./utils/utils.js";

const DEFAULT_METADATA_COL = "langchain_metadata";
type Row = { [key: string]: string };

// Options for PostgresLoader
export interface PostgresLoaderOptions {
  tableName?: string;
  schemaName?: string;
  contentColumns?: string[];
  metadataColumns?: string[];
  format?: "text" | "json" | "yaml" | "csv";
  formatter?: (row: Row, contentColumns: string[]) => string;
  query?: string;
  metadataJsonColumn?: string | null;
}

function parseDocFromRow(
  contentColumns: string[],
  metadataColumns: string[],
  row: Row,
  metadataJsonColumn: string | null = DEFAULT_METADATA_COL,
  formatter: (row: Row, contentColumns: string[]) => string = textFormatter
): Document {
  const pageContent = formatter(row, contentColumns);
  const metadata: { [key: string]: string } = {};

  if (metadataJsonColumn && row[metadataJsonColumn]) {
    Object.entries(row[metadataJsonColumn]).forEach(([k, v]) => {
      metadata[k] = v;
    });
  }

  metadataColumns.forEach((column) => {
    if (column in row && column !== metadataJsonColumn) {
      metadata[column] = row[column];
    }
  });

  return { pageContent, metadata };
}

/**
 * Google Cloud SQL for PostgreSQL vector store integration.
 *
 * Setup:
 * Install`@langchain/google-cloud-sql-pg`
 *
 * ```bash
 * npm install @langchain/google-cloud-sql-pg
 * ```
 *
 * <details open >
 * <summary><strong>Use with Table Name < /strong></summary >
 *
 * ```typescript
 * import { PostgresEngine, PostgresLoader } from "@langchain/google-cloud-sql-pg";
 *
 * const documentLoaderArgs: PostgresLoaderOptions = {
 *   tableName: "test_table_custom",
 *   contentColumns: [ "fruit_name", "variety"],
 *   metadataColumns: ["fruit_id", "quantity_in_stock", "price_per_unit", "organic"],
 *   format: "text"
 * };
 *
 * const documentLoaderInstance = await PostgresLoader.initialize(PEInstance, documentLoaderArgs);
 *
 * const documents = await documentLoaderInstance.load();
 * ```
 * </details>
 *
 * <br />
 *
 * <details open >
 * <summary><strong>Use with Query < /strong></summary >
 *
 * ```typescript
 * import { PostgresEngine, PostgresLoader } from "@langchain/google-cloud-sql-pg";
 *
 * const documentLoaderArgs: PostgresLoaderOptions = {
 *   query: "SELECT * FROM my_table WHERE organic = true;",
 *   contentColumns: [ "fruit_name", "variety"],
 *   metadataColumns: ["fruit_id", "quantity_in_stock", "price_per_unit", "organic"],
 *   format: "text"
 * };
 *
 * const documentLoaderInstance = await PostgresLoader.initialize(PEInstance, documentLoaderArgs);
 *
 * for await (const doc of documentLoaderInstance.lazyLoad()) {
 *   console.log(doc);
 *   break; // break based on required condition
 * }
 * ```
 * </details>
 *
 * <br />
 */
export class PostgresLoader extends BaseDocumentLoader {
  private engine: PostgresEngine;

  tableName?: string;

  schemaName?: string;

  contentColumns?: string[];

  metadataColumns?: string[];

  format?: "text" | "json" | "yaml" | "csv";

  formatter?: (row: Row, contentColumns: string[]) => string;

  query?: string;

  metadataJsonColumn?: string | null;

  constructor(engine: PostgresEngine, options: PostgresLoaderOptions) {
    super();
    this.engine = engine;
    this.contentColumns = options.contentColumns;
    this.metadataColumns = options.metadataColumns;
    this.query = options.query;
    this.formatter = options.formatter;
    this.metadataJsonColumn = options.metadataJsonColumn;
  }

  static async initialize(
    engine: PostgresEngine,
    {
      schemaName = "public",
      tableName,
      contentColumns,
      metadataColumns,
      format,
      query,
      formatter,
      metadataJsonColumn,
    }: PostgresLoaderOptions
  ): Promise<PostgresLoader> {
    if (tableName && query) {
      throw new Error(
        "Only one of 'table_name' or 'query' should be specified."
      );
    }
    if (!tableName && !query) {
      throw new Error(
        "At least one of the parameters 'table_name' or 'query' needs to be provided"
      );
    }
    if (format && formatter) {
      throw new Error(
        "Only one of 'format' or 'formatter' should be specified."
      );
    }

    if (format && !["csv", "text", "json", "yaml"].includes(format)) {
      throw new Error("format must be type: 'csv', 'text', 'json', 'yaml'");
    }

    let formatFunc = formatter;
    if (formatFunc === undefined) {
      if (format === "csv") {
        formatFunc = csvFormatter;
      } else if (format === "yaml") {
        formatFunc = yamlFormatter;
      } else if (format === "json") {
        formatFunc = jsonFormatter;
      } else {
        formatFunc = textFormatter;
      }
    }

    let queryStmt = query;
    if (!queryStmt) {
      queryStmt = `SELECT * FROM "${schemaName}"."${tableName}"`;
    }

    let result;
    try {
      result = await engine.pool.raw(queryStmt);
    } catch (error) {
      if (typeof error === "string") {
        throw Error(error);
      }
    }
    const columnNames = result.fields.map(
      (field: { name: string }) => field.name
    );

    const contentColumnNames = contentColumns || [columnNames[0]];
    const metadataColumnNames =
      metadataColumns ||
      columnNames.filter((col: string) => !contentColumnNames.includes(col));

    if (metadataJsonColumn && !columnNames.includes(metadataJsonColumn)) {
      throw new Error(
        `Column ${metadataJsonColumn} not found in query result ${columnNames}.`
      );
    }
    let jsonColumnName = metadataJsonColumn;
    if (!jsonColumnName && columnNames.includes(DEFAULT_METADATA_COL)) {
      jsonColumnName = DEFAULT_METADATA_COL;
    }

    const allNames = [
      ...(contentColumnNames || []),
      ...(metadataColumnNames || []),
    ];
    allNames.forEach((name) => {
      if (!columnNames.includes(name)) {
        throw new Error(
          `Column ${name} not found in query result ${columnNames}.`
        );
      }
    });

    return new PostgresLoader(engine, {
      contentColumns: contentColumnNames,
      metadataColumns: metadataColumnNames,
      query: queryStmt,
      formatter: formatFunc,
      metadataJsonColumn: jsonColumnName,
    });
  }

  async load(): Promise<Document[]> {
    const documents: Document[] = [];
    for await (const doc of this.lazyLoad()) {
      documents.push(doc);
    }
    return documents;
  }

  async *lazyLoad(): AsyncGenerator<Document> {
    const {
      query,
      contentColumns,
      metadataColumns,
      formatter,
      metadataJsonColumn,
    } = this;
    try {
      if (!query) {
        throw new Error("Query is undefined");
      }
      const result = await this.engine.pool.raw(query);

      for (const row of result.rows) {
        const rowData: Row = {};
        const columnNames = [
          ...(contentColumns || []),
          ...(metadataColumns || []),
        ];
        if (metadataJsonColumn) {
          columnNames.push(metadataJsonColumn);
        }
        columnNames.forEach((column) => {
          rowData[column] = row[column];
        });

        yield parseDocFromRow(
          contentColumns || [],
          metadataColumns || [],
          rowData,
          metadataJsonColumn,
          formatter
        );
      }
    } catch (error) {
      if (typeof error === "string") {
        throw Error(error);
      }
    }
  }
}
