import { Tool } from "./base.js";
import { OpenAI } from "../../llms/index.js";
import { LLMChain } from "../../chains/index.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { SqlDatabase } from "../../sql_db.js";
import { SqlTable } from "../../util/sql_utils.js";

interface SqlTool {
  db: SqlDatabase;
}

export class QuerySqlTool extends Tool implements SqlTool {
  name = "query-sql";

  db: SqlDatabase;

  constructor(db: SqlDatabase) {
    super();
    this.db = db;
  }

  async _call(input: string) {
    try {
      return await this.db.run(input);
    } catch (error) {
      return `${error}`;
    }
  }

  description = `Input to this tool is a detailed and correct SQL query, output is a result from the database.
  If the query is not correct, an error message will be returned. 
  If an error is returned, rewrite the query, check the query, and try again.`;
}

export class InfoSqlTool extends Tool implements SqlTool {
  name = "info-sql";

  db: SqlDatabase;

  constructor(db: SqlDatabase) {
    super();
    this.db = db;
  }

  // get the table names for a comma separated list of tables, return error message in strong format
  async _call(input: string) {
    try {
      const tables = input.split(",").map((table) => table.trim());
      return await this.db.getTableInfo(tables);
    } catch (error) {
      return `${error}`;
    }
  }

  description = `Input to this tool is a comma-separated list of tables, output is the schema and sample rows for those tables.
    Be sure that the tables actually exist by calling list-tables-sql first!
    
    Example Input: "table1, table2, table3.`;
}

export class ListTablesSqlTool extends Tool implements SqlTool {
  name = "list-tables-sql";

  db: SqlDatabase;

  constructor(db: SqlDatabase) {
    super();
    this.db = db;
  }

  async _call(_: string) {
    try {
      const tables = this.db.allTables.map(
        (table: SqlTable) => table.tableName
      );
      return tables.join(", ");
    } catch (error) {
      return `${error}`;
    }
  }

  description = `Input is an empty string, output is a comma separated list of tables in the database.`;
}

export class QueryCheckerTool extends Tool {
  name = "query-checker";

  template = `
    {query}
Double check the sqlite query above for common mistakes, including:
- Using NOT IN with NULL values
- Using UNION when UNION ALL should have been used
- Using BETWEEN for exclusive ranges
- Data type mismatch in predicates
- Properly quoting identifiers
- Using the correct number of arguments for functions
- Casting to the correct data type
- Using the proper columns for joins

If there are any of the above mistakes, rewrite the query. If there are no mistakes, just reproduce the original query.`;

  llmChain: LLMChain;

  constructor(llmChain?: LLMChain) {
    super();
    if (llmChain) {
      this.llmChain = llmChain;
    } else {
      const model = new OpenAI({ temperature: 0 });
      const prompt = new PromptTemplate({
        template: this.template,
        inputVariables: ["query"],
      });
      this.llmChain = new LLMChain({ llm: model, prompt });
    }
  }

  async _call(input: string) {
    return this.llmChain.predict({ query: input });
  }

  description = `
    Use this tool to double check if your query is correct before executing it.
    Always use this tool before executing a query with query-sql!`;
}
