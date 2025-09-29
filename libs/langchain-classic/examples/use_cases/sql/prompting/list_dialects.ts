import { SQL_PROMPTS_MAP } from "langchain/chains/sql_db";

console.log({ SQL_PROMPTS_MAP: Object.keys(SQL_PROMPTS_MAP) });
/**
{
  SQL_PROMPTS_MAP: [ 'oracle', 'postgres', 'sqlite', 'mysql', 'mssql', 'sap hana' ]
}
 */

// For example, using our current DB we can see that we’ll get a SQLite-specific prompt:

console.log({
  sqlite: SQL_PROMPTS_MAP.sqlite,
});
/**
{
  sqlite: PromptTemplate {
    inputVariables: [ 'dialect', 'table_info', 'input', 'top_k' ],
    template: 'You are a SQLite expert. Given an input question, first create a syntactically correct SQLite query to run, then look at the results of the query and return the answer to the input question.\n' +
      'Unless the user specifies in the question a specific number of examples to obtain, query for at most {top_k} results using the LIMIT clause as per SQLite. You can order the results to return the most informative data in the database.\n' +
      'Never query for all columns from a table. You must query only the columns that are needed to answer the question. Wrap each column name in double quotes (") to denote them as delimited identifiers.\n' +
      'Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.\n' +
      '\n' +
      'Use the following format:\n' +
      '\n' +
      'Question: "Question here"\n' +
      'SQLQuery: "SQL Query to run"\n' +
      'SQLResult: "Result of the SQLQuery"\n' +
      'Answer: "Final answer here"\n' +
      '\n' +
      'Only use the following tables:\n' +
      '{table_info}\n' +
      '\n' +
      'Question: {input}',
  }
}
 */
