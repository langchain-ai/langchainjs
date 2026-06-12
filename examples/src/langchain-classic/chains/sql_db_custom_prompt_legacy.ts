import { OpenAI } from "@langchain/openai";
import { SqlDatabase } from "@langchain/classic/sql_db";
import { SqlDatabaseChain } from "@langchain/classic/chains/sql_db";
import { PromptTemplate } from "@langchain/core/prompts";

const template = `Given an input question, first create a syntactically correct {dialect} query to run, then look at the results of the query and return the answer.
Use the following format:

Question: "Question here"
SQLQuery: "SQL Query to run"
SQLResult: "Result of the SQLQuery"
Answer: "Final answer here"

Only use the following tables:

{table_info}

If someone asks for the table foobar, they really mean the employee table.

Question: {input}`;

const prompt = PromptTemplate.fromTemplate(template);

/**
 * This example uses Chinook database, which is a sample database available for SQL Server, Oracle, MySQL, etc.
 * To set it up follow the instructions on https://database.guide/2-sample-databases-sqlite/, placing the .db file
 * in the examples folder.
 */
const datasourceConfig = {
  type: "sqlite",
  database: "data/Chinook.db",
} as const;

const db = await SqlDatabase.fromOptionsParams({
  appDataSourceOptions: datasourceConfig,
});

const chain = new SqlDatabaseChain({
  llm: new OpenAI({ temperature: 0 }),
  database: db,
  sqlOutputKey: "sql",
  prompt,
});

const res = await chain.invoke({
  query: "How many employees are there in the foobar table?",
});
console.log(res);

/*
  {
    result: ' There are 8 employees in the foobar table.',
    sql: ' SELECT COUNT(*) FROM Employee;'
  }
*/
