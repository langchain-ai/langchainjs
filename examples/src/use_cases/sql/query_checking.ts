import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { SqlDatabaseChain, createSqlQueryChain } from "langchain/chains/sql_db";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";

const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
const chain = new SqlDatabaseChain({
  llm,
  database: db,
  inputKey: "question",
});

/**
 * And we want to validate its outputs. We can do so by extending the chain with a second prompt and model call:
 */

const SYSTEM_PROMPT = `Double check the user's {dialect} query for common mistakes, including:
- Using NOT IN with NULL values
- Using UNION when UNION ALL should have been used
- Using BETWEEN for exclusive ranges
- Data type mismatch in predicates
- Properly quoting identifiers
- Using the correct number of arguments for functions
- Casting to the correct data type
- Using the proper columns for joins

If there are any of the above mistakes, rewrite the query. If there are no mistakes, just reproduce the original query.

Output the final SQL query only.`;

const prompt = await ChatPromptTemplate.fromMessages([
  ["system", SYSTEM_PROMPT],
  ["human", "{query}"],
]).partial({ dialect: "sqlite" });

const validationChain = prompt.pipe(llm).pipe(new StringOutputParser());

const fullChain = RunnableSequence.from([
  {
    query: async (i: { question: string }) => {
      const { result } = await chain.invoke(i);
      return result;
    },
  },
  validationChain,
]);
const query = await fullChain.invoke({
  question:
    "What's the average Invoice from an American customer whose Fax is missing since 2003 but before 2010",
});
console.log(query);
/**
SELECT AVG(Invoice)
FROM Customers
JOIN Invoices ON Customers.CustomerId = Invoices.CustomerId
WHERE Customers.Country = 'USA'
AND Customers.Fax IS NULL
AND Invoices.InvoiceDate >= '2003-01-01'
AND Invoices.InvoiceDate < '2010-01-01'
AND Invoice = 6.633;
 */
console.log(await db.run(query));
/**
 * 
 */

// The obvious downside of this approach is that we need to make two model calls instead of one to generate our query.
// To get around this we can try to perform the query generation and query check in a single model invocation:

const SYSTEM_PROMPT_2 = `You are a {dialect} expert. Given an input question, create a syntactically correct {dialect} query to run.
Unless the user specifies in the question a specific number of examples to obtain, query for at most {top_k} results using the LIMIT clause as per {dialect}. You can order the results to return the most informative data in the database.
Never query for all columns from a table. You must query only the columns that are needed to answer the question. Wrap each column name in double quotes (") to denote them as delimited identifiers.
Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.
Pay attention to use date('now') function to get the current date, if the question involves "today".

Only use the following tables:
{table_info}

Write an initial draft of the query. Then double check the {dialect} query for common mistakes, including:
- Using NOT IN with NULL values
- Using UNION when UNION ALL should have been used
- Using BETWEEN for exclusive ranges
- Data type mismatch in predicates
- Properly quoting identifiers
- Using the correct number of arguments for functions
- Casting to the correct data type
- Using the proper columns for joins

Use format:

First draft: <<FIRST_DRAFT_QUERY>>
Final answer: <<FINAL_ANSWER_QUERY>>`;

const prompt2 = await PromptTemplate.fromTemplate(
  `System: ${SYSTEM_PROMPT_2}

Human: {input}`
).partial({ dialect: "sqlite" });

const parseFinalAnswer = (output: string): string =>
  output.split("Final answer: ")[1];

const chain2 = (
  await createSqlQueryChain({
    llm,
    db,
    prompt: prompt2,
    dialect: "sqlite",
  })
).pipe(parseFinalAnswer);

const result = await chain2.invoke({
  question:
    "What's the average Invoice from an American customer whose Fax is missing since 2003 but before 2010",
});
console.log(result);
/**
 * 
 */
console.log(await db.run(result));
/**
 * 
 */
