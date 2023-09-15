import { DataSource } from "typeorm";
import { SqlDatabase } from "langchain/sql_db";
import { RunnableSequence } from "langchain/schema/runnable";
import { PromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";
import { ChatOpenAI } from "langchain/chat_models/openai";

const datasource = new DataSource({
  type: "sqlite",
  database: "Chinook.db",
});

const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

const prompt =
  PromptTemplate.fromTemplate(`Based on the table schema below, write a SQL query that would answer the user's question:
{schema}

Question: {question}
SQL Query:`);

const model = new ChatOpenAI();

const sqlQueryGeneratorChain = RunnableSequence.from([
  {
    schema: async () => db.getTableInfo(),
    question: (input: { question: string }) => input.question,
  },
  prompt,
  model.bind({ stop: ["\nSQLResult:"] }),
  new StringOutputParser(),
]);

const result = await sqlQueryGeneratorChain.invoke({
  question: "How many employees are there?",
});

console.log(result);

/*
  SELECT COUNT(EmployeeId) AS TotalEmployees FROM Employee
*/

const finalResponsePrompt =
  PromptTemplate.fromTemplate(`Based on the table schema below, question, sql query, and sql response, write a natural language response:
{schema}

Question: {question}
SQL Query: {query}
SQL Response: {response}`);

const fullChain = RunnableSequence.from([
  {
    question: (input) => input.question,
    query: sqlQueryGeneratorChain,
  },
  {
    schema: async () => db.getTableInfo(),
    question: (input) => input.question,
    query: (input) => input.query,
    response: (input) => db.run(input.query),
  },
  finalResponsePrompt,
  model,
]);

const finalResponse = await fullChain.invoke({
  question: "How many employees are there?",
});

console.log(finalResponse);

/*
  AIMessage {
    content: 'There are 8 employees.',
    additional_kwargs: { function_call: undefined }
  }
*/
