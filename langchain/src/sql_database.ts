import { DataSource } from "typeorm";
import {
    generateTableInfoFromTables,
    getTableAndColumnsName,
    SQLDatabaseParams,
    SqlTable,
    verifyIgnoreTablesExistInDatabase,
    verifyIncludeTablesExistInDatabase,
    verifyListTablesExistInDatabase
} from './util/sql_utils.js';

export class SQLDatabase {
    appDataSource: DataSource;

    allTables: Array<SqlTable> = [];

    includesTables: Array<string> = [];

    ignoreTables: Array<string> = [];

    sampleRowsInTableInfo = 3;

    constructor(fields: SQLDatabaseParams) {
        this.appDataSource = fields.appDataSource;
        if (fields?.includesTables && fields?.ignoreTables) {
            throw new Error(
                "Cannot specify both include_tables and ignoreTables"
            );

        }
        this.includesTables = fields?.includesTables ?? [];
        this.ignoreTables = fields?.ignoreTables ?? [];
        this.sampleRowsInTableInfo = fields?.sampleRowsInTableInfo ?? this.sampleRowsInTableInfo;
    }

    static async fromDataSource(fields: SQLDatabaseParams): Promise<SQLDatabase> {
        const sqlDatabase = new SQLDatabase(fields);
        await sqlDatabase.appDataSource.initialize();
        sqlDatabase.allTables = await getTableAndColumnsName(fields.appDataSource);
        verifyIncludeTablesExistInDatabase(sqlDatabase.allTables, sqlDatabase.includesTables);
        verifyIgnoreTablesExistInDatabase(sqlDatabase.allTables, sqlDatabase.ignoreTables);

        return sqlDatabase;
    }

    /**
     * """Get information about specified tables.
     *
     * Follows best practices as specified in: Rajkumar et al, 2022
     * (https://arxiv.org/abs/2204.00498)
     *
     * If `sample_rows_in_table_info`, the specified number of sample rows will be
     * appended to each table description. This can increase performance as
     * demonstrated in the paper.
     */
    async getTableInfo(targetTables?: Array<string>): Promise<string> {
        let selectedTables = this.allTables;
        if (targetTables && targetTables.length > 0) {
            verifyListTablesExistInDatabase(this.allTables, targetTables, 'Wrong target table name:');
            selectedTables = this.allTables.filter((currentTable) => targetTables.includes(currentTable.tableName));
        }

        return generateTableInfoFromTables(selectedTables, this.appDataSource, this.sampleRowsInTableInfo);
    }

    /** Execute a SQL command and return a string representing the results.
     *  If the statement returns rows, a string of the results is returned.
     *  If the statement returns no rows, an empty string is returned.
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
}
