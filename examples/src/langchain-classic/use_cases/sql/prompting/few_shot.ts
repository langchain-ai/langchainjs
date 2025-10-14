import { FewShotPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { examples } from "./examples.js";

const examplePrompt = PromptTemplate.fromTemplate(
  `User input: {input}\nSQL Query: {query}`
);

const prompt = new FewShotPromptTemplate({
  examples: examples.slice(0, 5),
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

User input: Find all albums for the artist 'AC/DC'.
SQL Query: SELECT * FROM Album WHERE ArtistId = (SELECT ArtistId FROM Artist WHERE Name = 'AC/DC');

User input: List all tracks in the 'Rock' genre.
SQL Query: SELECT * FROM Track WHERE GenreId = (SELECT GenreId FROM Genre WHERE Name = 'Rock');

User input: Find the total duration of all tracks.
SQL Query: SELECT SUM(Milliseconds) FROM Track;

User input: List all customers from Canada.
SQL Query: SELECT * FROM Customer WHERE Country = 'Canada';

User input: How many artists are there?
SQL query:
 */
