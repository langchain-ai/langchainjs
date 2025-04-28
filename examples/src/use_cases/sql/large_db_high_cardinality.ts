import { DocumentInterface } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createSqlQueryChain } from "langchain/chains/sql_db";
import { SqlDatabase } from "langchain/sql_db";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { DataSource } from "typeorm";

const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});

async function queryAsList(database: any, query: string): Promise<string[]> {
  const res: Array<{ [key: string]: string }> = JSON.parse(
    await database.run(query)
  )
    .flat()
    .filter((el: any) => el != null);
  const justValues: Array<string> = res.map((item) =>
    Object.values(item)[0]
      .replace(/\b\d+\b/g, "")
      .trim()
  );
  return justValues;
}

let properNouns: string[] = await queryAsList(db, "SELECT Name FROM Artist");
properNouns = properNouns.concat(
  await queryAsList(db, "SELECT Title FROM Album")
);
properNouns = properNouns.concat(
  await queryAsList(db, "SELECT Name FROM Genre")
);

console.log(properNouns.length);
/**
647
 */
console.log(properNouns.slice(0, 5));
/**
[
  'AC/DC',
  'Accept',
  'Aerosmith',
  'Alanis Morissette',
  'Alice In Chains'
]
 */

// Now we can embed and store all of our values in a vector database:

const vectorDb = await MemoryVectorStore.fromTexts(
  properNouns,
  {},
  new OpenAIEmbeddings()
);
const retriever = vectorDb.asRetriever(15);

// And put together a query construction chain that first retrieves values from the database and inserts them into the prompt:

const system = `You are a SQLite expert. Given an input question, create a syntactically correct SQLite query to run.
Unless otherwise specified, do not return more than {top_k} rows.

Here is the relevant table info: {table_info}

Here is a non-exhaustive list of possible feature values.
If filtering on a feature value make sure to check its spelling against this list first:

{proper_nouns}`;
const prompt = ChatPromptTemplate.fromMessages([
  ["system", system],
  ["human", "{input}"],
]);

const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });

const queryChain = await createSqlQueryChain({
  llm,
  db,
  prompt,
  dialect: "sqlite",
});
const retrieverChain = RunnableSequence.from([
  (i: { question: string }) => i.question,
  retriever,
  (docs: Array<DocumentInterface>) =>
    docs.map((doc) => doc.pageContent).join("\n"),
]);
const chain = RunnablePassthrough.assign({
  proper_nouns: retrieverChain,
}).pipe(queryChain);

// To try out our chain, let’s see what happens when we try filtering on “elenis moriset”, a misspelling of Alanis Morissette, without and with retrieval:

// Without retrieval
const query = await queryChain.invoke({
  question: "What are all the genres of Elenis Moriset songs?",
  proper_nouns: "",
});
console.log("query", query);
/**
query SELECT DISTINCT Genre.Name
FROM Genre
JOIN Track ON Genre.GenreId = Track.GenreId
JOIN Album ON Track.AlbumId = Album.AlbumId
JOIN Artist ON Album.ArtistId = Artist.ArtistId
WHERE Artist.Name = 'Elenis Moriset'
LIMIT 5;
 */
console.log("db query results", await db.run(query));
/**
db query results []
 */

// -------------

// You can see a LangSmith trace of the above chain here:
// https://smith.langchain.com/public/b153cb9b-6fbb-43a8-b2ba-4c86715183b9/r

// -------------

// With retrieval:
const query2 = await chain.invoke({
  question: "What are all the genres of Elenis Moriset songs?",
});
console.log("query2", query2);
/**
query2 SELECT DISTINCT Genre.Name
FROM Genre
JOIN Track ON Genre.GenreId = Track.GenreId
JOIN Album ON Track.AlbumId = Album.AlbumId
JOIN Artist ON Album.ArtistId = Artist.ArtistId
WHERE Artist.Name = 'Alanis Morissette';
 */
console.log("db query results", await db.run(query2));
/**
db query results [{"Name":"Rock"}]
 */

// -------------

// You can see a LangSmith trace of the above chain here:
// https://smith.langchain.com/public/2f4f0e37-3b7f-47b5-837c-e2952489cac0/r

// -------------
