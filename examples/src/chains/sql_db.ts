import { DataSource } from "typeorm";
import { OpenAI } from "langchain/llms/openai";
import { SqlDatabase } from "langchain/sql_db";
import { SqlDatabaseChain } from "langchain/chains/sql_db";
import { PromptTemplate } from "langchain/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "langchain/schema/runnable";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { StringOutputParser } from "langchain/schema/output_parser";

/**
 * This example uses Chinook database, which is a sample database available for SQL Server, Oracle, MySQL, etc.
 * To set it up follow the instructions on https://database.guide/2-sample-databases-sqlite/, placing the .db file
 * in the examples folder.
 */
const datasource = new DataSource({
  type: "sqlite",
  database: "Chinook.db",
});

const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

const llm = new ChatOpenAI();

const prompt =
  PromptTemplate.fromTemplate(`Based on the provided SQL table schema below, write a SQL query that would answer the user's question.
------------
SCHEMA: {schema}
------------
QUESTION: {question}
------------
SQL QUERY:`);

const sqlQueryChain = RunnableSequence.from([
  {
    schema: async () => db.getTableInfo(),
    question: (input: { question: string }) => input.question,
  },
  prompt,
  llm.bind({ stop: ["\nSQLResult:"] }),
  new StringOutputParser(),
]);

const res = await sqlQueryChain.invoke({
  question: "How many employees are there?",
});
console.log({ res });

/**
 * { res: 'SELECT COUNT(*) FROM tracks;' }
 */

const finalResponsePrompt =
  PromptTemplate.fromTemplate(`Based on the table schema below, question, SQL query, and SQL response, write a natural language response:
------------
SCHEMA: {schema}
------------
QUESTION: {question}
------------
SQL QUERY: {query}
------------
SQL RESPONSE: {response}
------------
NATURAL LANGUAGE RESPONSE:`);

const finalChain = RunnableSequence.from([
  {
    question: (input) => input.question,
    query: sqlQueryChain,
  },
  {
    schema: async () => db.getTableInfo(),
    question: (input) => input.question,
    query: (input) => input.query,
    response: (input) => db.run(input.query),
  },
  finalResponsePrompt,
  llm,
  new StringOutputParser(),
]);

const finalResponse = await finalChain.invoke({
  question: "How many employees are there?",
});

console.log({ finalResponse });

/**
 * { finalResponse: 'There are 8 employees.' }
 */
