import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { createStructuredOutputRunnable } from "langchain/chains/openai_functions";
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
const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });

const Table = z.object({
  names: z.array(z.string()).describe("Names of tables in SQL database"),
});

const tableNames = db.allTables.map((t) => t.tableName).join("\n");
const system = `Return the names of ALL the SQL tables that MIGHT be relevant to the user question.
The tables are:

${tableNames}

Remember to include ALL POTENTIALLY RELEVANT tables, even if you're not sure that they're needed.`;

const tableChain = createStructuredOutputRunnable({
  llm,
  outputSchema: Table,
  prompt: ChatPromptTemplate.fromMessages([
    ["system", system],
    ["human", "{input}"],
  ]),
});
console.log(
  await tableChain.invoke({
    input: "What are all the genres of Alanis Morisette songs?",
  })
);
/**
{ names: [ 'Genre', 'Artist', 'Track' ] }
 */

// -------------

// You can see a LangSmith trace of the above chain here:
// ADD_LINK

// -------------

/**
This works pretty well! Except, as we’ll see below, we actually need a few other tables as well.
This would be pretty difficult for the model to know based just on the user question.
In this case, we might think to simplify our model’s job by grouping the tables together.
We’ll just ask the model to choose between categories “Music” and “Business”, and then take care of selecting all the relevant tables from there:
 */

const system2 = `Return the names of the SQL tables that are relevant to the user question.
The tables are:

Music
Business`;
const categoryChain = createStructuredOutputRunnable<
  { input: string },
  z.infer<typeof Table>
>({
  llm,
  outputSchema: Table,
  prompt: ChatPromptTemplate.fromMessages([
    ["system", system2],
    ["human", "{input}"],
  ]),
});
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
// ADD_LINK

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
// ADD_LINK

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
SELECT Genre.Name
FROM Genre
JOIN Track ON Genre.GenreId = Track.GenreId
JOIN Album ON Track.AlbumId = Album.AlbumId
JOIN Artist ON Album.ArtistId = Artist.ArtistId
WHERE Artist.Name = "Alanis Morisette"
LIMIT 5;
 */

console.log(await db.run(query));
/**

 */

// -------------

// You can see a LangSmith trace of the above chain here:
// ADD_LINK

// -------------

// We might rephrase our question slightly to remove redundancy in the answer
const query2 = await fullChain.invoke({
  question: "What is the set of all unique genres of Alanis Morisette songs?",
});
console.log(query2);
/**
SELECT DISTINCT Genre.Name
FROM Genre
JOIN Track ON Genre.GenreId = Track.GenreId
JOIN Album ON Track.AlbumId = Album.AlbumId
JOIN Artist ON Album.ArtistId = Artist.ArtistId
WHERE Artist.Name = "Alanis Morisette"
 */
console.log(await db.run(query2));
/**

 */

// -------------

// You can see a LangSmith trace of the above chain here:
// ADD_LINK

// -------------
