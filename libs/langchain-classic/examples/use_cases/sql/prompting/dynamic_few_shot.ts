import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { SemanticSimilarityExampleSelector } from "@langchain/core/example_selectors";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { FewShotPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { createSqlQueryChain } from "langchain/chains/sql_db";
import { examples } from "./examples.js";
import { db } from "../db.js";

const exampleSelector = await SemanticSimilarityExampleSelector.fromExamples<
  typeof MemoryVectorStore
>(examples, new OpenAIEmbeddings(), MemoryVectorStore, {
  k: 5,
  inputKeys: ["input"],
});

console.log(
  await exampleSelector.selectExamples({ input: "how many artists are there?" })
);
/**
[
  { input: 'List all artists.', query: 'SELECT * FROM Artist;' },
  {
    input: 'How many employees are there',
    query: 'SELECT COUNT(*) FROM "Employee"'
  },
  {
    input: 'How many tracks are there in the album with ID 5?',
    query: 'SELECT COUNT(*) FROM Track WHERE AlbumId = 5;'
  },
  {
    input: 'Which albums are from the year 2000?',
    query: "SELECT * FROM Album WHERE strftime('%Y', ReleaseDate) = '2000';"
  },
  {
    input: "List all tracks in the 'Rock' genre.",
    query: "SELECT * FROM Track WHERE GenreId = (SELECT GenreId FROM Genre WHERE Name = 'Rock');"
  }
]
 */

// To use it, we can pass the ExampleSelector directly in to our FewShotPromptTemplate:

const examplePrompt = PromptTemplate.fromTemplate(
  `User input: {input}\nSQL Query: {query}`
);

const prompt = new FewShotPromptTemplate({
  exampleSelector,
  examplePrompt,
  prefix: `You are a SQLite expert. Given an input question, create a syntactically correct SQLite query to run.
Unless otherwise specified, do not return more than {top_k} rows.

Here is the relevant table info: {table_info}

Below are a number of examples of questions and their corresponding SQL queries.`,
  suffix: "User input: {input}\nSQL query: ",
  inputVariables: ["input", "top_k", "table_info"],
});

console.log(
  await prompt.format({
    input: "How many artists are there?",
    top_k: "3",
    table_info: "foo",
  })
);
/**
You are a SQLite expert. Given an input question, create a syntactically correct SQLite query to run.
Unless otherwise specified, do not return more than 3 rows.

Here is the relevant table info: foo

Below are a number of examples of questions and their corresponding SQL queries.

User input: List all artists.
SQL Query: SELECT * FROM Artist;

User input: How many employees are there
SQL Query: SELECT COUNT(*) FROM "Employee"

User input: How many tracks are there in the album with ID 5?
SQL Query: SELECT COUNT(*) FROM Track WHERE AlbumId = 5;

User input: Which albums are from the year 2000?
SQL Query: SELECT * FROM Album WHERE strftime('%Y', ReleaseDate) = '2000';

User input: List all tracks in the 'Rock' genre.
SQL Query: SELECT * FROM Track WHERE GenreId = (SELECT GenreId FROM Genre WHERE Name = 'Rock');

User input: How many artists are there?
SQL query:
 */

// Now we can use it in a chain:

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});
const chain = await createSqlQueryChain({
  db,
  llm,
  prompt,
  dialect: "sqlite",
});

console.log(await chain.invoke({ question: "how many artists are there?" }));

/**
SELECT COUNT(*) FROM Artist;
 */
