import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { createSqlQueryChain } from "langchain/chains/sql_db";
import { SqlDatabase } from "langchain/sql_db";
import { DataSource } from "typeorm";
import { z } from "zod";

const datasource = new DataSource({
  type: "sqlite",
  database: "../../../../Chinook.db",
});
const db = await SqlDatabase.fromDataSourceParams({
  appDataSource: datasource,
});
const llm = new ChatOpenAI({ model: "gpt-4", temperature: 0 });

const Table = z.object({
  names: z.array(z.string()).describe("Names of tables in SQL database"),
});

const tableNames = db.allTables.map((t) => t.tableName).join("\n");
const system = `Return the names of ALL the SQL tables that MIGHT be relevant to the user question.
The tables are:

${tableNames}

Remember to include ALL POTENTIALLY RELEVANT tables, even if you're not sure that they're needed.`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", system],
  ["human", "{input}"],
]);
const tableChain = prompt.pipe(llm.withStructuredOutput(Table));

console.log(
  await tableChain.invoke({
    input: "What are all the genres of Alanis Morisette songs?",
  })
);
/**
{ names: [ 'Artist', 'Track', 'Genre' ] }
 */

// -------------

// You can see a LangSmith trace of the above chain here:
// https://smith.langchain.com/public/5ca0c91e-4a40-44ef-8c45-9a4247dc474c/r

// -------------

/**
This works pretty well! Except, as we’ll see below, we actually need a few other tables as well.
This would be pretty difficult for the model to know based just on the user question.
In this case, we might think to simplify our model’s job by grouping the tables together.
We’ll just ask the model to choose between categories “Music” and “Business”, and then take care of selecting all the relevant tables from there:
 */

const prompt2 = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Return the names of the SQL tables that are relevant to the user question.
  The tables are:
  
  Music
  Business`,
  ],
  ["human", "{input}"],
]);
const categoryChain = prompt2.pipe(llm.withStructuredOutput(Table));
console.log(
  await categoryChain.invoke({
    input: "What are all the genres of Alanis Morisette songs?",
  })
);
/**
{ names: [ 'Music' ] }
 */

// -------------

// You can see a LangSmith trace of the above chain here:
// https://smith.langchain.com/public/12b62e78-bfbe-42ff-86f2-ad738a476554/r

// -------------

const getTables = (categories: z.infer<typeof Table>): Array<string> => {
  let tables: Array<string> = [];
  for (const category of categories.names) {
    if (category === "Music") {
      tables = tables.concat([
        "Album",
        "Artist",
        "Genre",
        "MediaType",
        "Playlist",
        "PlaylistTrack",
        "Track",
      ]);
    } else if (category === "Business") {
      tables = tables.concat([
        "Customer",
        "Employee",
        "Invoice",
        "InvoiceLine",
      ]);
    }
  }
  return tables;
};

const tableChain2 = categoryChain.pipe(getTables);
console.log(
  await tableChain2.invoke({
    input: "What are all the genres of Alanis Morisette songs?",
  })
);
/**
[
  'Album',
  'Artist',
  'Genre',
  'MediaType',
  'Playlist',
  'PlaylistTrack',
  'Track'
]
 */

// -------------

// You can see a LangSmith trace of the above chain here:
// https://smith.langchain.com/public/e78c10aa-e923-4a24-b0c8-f7a6f5d316ce/r

// -------------

// Now that we’ve got a chain that can output the relevant tables for any query we can combine this with our createSqlQueryChain, which can accept a list of tableNamesToUse to determine which table schemas are included in the prompt:

const queryChain = await createSqlQueryChain({
  llm,
  db,
  dialect: "sqlite",
});

const tableChain3 = RunnableSequence.from([
  {
    input: (i: { question: string }) => i.question,
  },
  tableChain2,
]);

const fullChain = RunnablePassthrough.assign({
  tableNamesToUse: tableChain3,
}).pipe(queryChain);
const query = await fullChain.invoke({
  question: "What are all the genres of Alanis Morisette songs?",
});
console.log(query);
/**
SELECT DISTINCT "Genre"."Name"
FROM "Genre"
JOIN "Track" ON "Genre"."GenreId" = "Track"."GenreId"
JOIN "Album" ON "Track"."AlbumId" = "Album"."AlbumId"
JOIN "Artist" ON "Album"."ArtistId" = "Artist"."ArtistId"
WHERE "Artist"."Name" = 'Alanis Morissette'
LIMIT 5;
 */

console.log(await db.run(query));
/**
[{"Name":"Rock"}]
 */

// -------------

// You can see a LangSmith trace of the above chain here:
// https://smith.langchain.com/public/c7d576d0-3462-40db-9edc-5492f10555bf/r

// -------------

// We might rephrase our question slightly to remove redundancy in the answer
const query2 = await fullChain.invoke({
  question: "What is the set of all unique genres of Alanis Morisette songs?",
});
console.log(query2);
/**
SELECT DISTINCT Genre.Name FROM Genre
JOIN Track ON Genre.GenreId = Track.GenreId
JOIN Album ON Track.AlbumId = Album.AlbumId
JOIN Artist ON Album.ArtistId = Artist.ArtistId
WHERE Artist.Name = 'Alanis Morissette'
 */
console.log(await db.run(query2));
/**
[{"Name":"Rock"}]
 */

// -------------

// You can see a LangSmith trace of the above chain here:
// https://smith.langchain.com/public/6e80087d-e930-4f22-9b40-f7edb95a2145/r

// -------------
