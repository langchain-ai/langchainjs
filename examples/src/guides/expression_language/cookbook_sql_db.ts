import { DataSource } from "typeorm";
import { SqlDatabase } from "langchain/sql_db";
import { ChatOpenAI } from "@langchain/openai";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

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

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

// The `RunnablePassthrough.assign()` is used here to passthrough the input from the `.invoke()`
// call (in this example it's the question), along with any inputs passed to the `.assign()` method.
// In this case, we're passing the schema.
const sqlQueryGeneratorChain = RunnableSequence.from([
  RunnablePassthrough.assign({
    schema: async () => db.getTableInfo(),
  }),
  prompt,
  model.withConfig({ stop: ["\nSQLResult:"] }),
  new StringOutputParser(),
]);

const result = await sqlQueryGeneratorChain.invoke({
  question: "How many employees are there?",
});

console.log({
  result,
});

/*
  {
    result: "SELECT COUNT(EmployeeId) AS TotalEmployees FROM Employee"
  }
*/

const finalResponsePrompt =
  PromptTemplate.fromTemplate(`Based on the table schema below, question, sql query, and sql response, write a natural language response:
{schema}

Question: {question}
SQL Query: {query}
SQL Response: {response}`);

const fullChain = RunnableSequence.from([
  RunnablePassthrough.assign({
    query: sqlQueryGeneratorChain,
  }),
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
