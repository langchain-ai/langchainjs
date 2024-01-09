import { CohereEmbeddings } from "@langchain/cohere";
import { VercelPostgres } from "@langchain/community/vectorstores/vercel_postgres";

// Config is only required if you want to override default values.
const config = {
  // tableName: "testvercelvectorstorelangchain",
  // postgresConnectionOptions: {
  //   connectionString: "postgres://<username>:<password>@<hostname>:<port>/<dbname>",
  // },
  // columns: {
  //   idColumnName: "id",
  //   vectorColumnName: "vector",
  //   contentColumnName: "content",
  //   metadataColumnName: "metadata",
  // },
};

const vercelPostgresStore = await VercelPostgres.initialize(
  new CohereEmbeddings(),
  config
);

const docHello = {
  pageContent: "hello",
  metadata: { topic: "nonsense" },
};
const docHi = { pageContent: "hi", metadata: { topic: "nonsense" } };
const docMitochondria = {
  pageContent: "Mitochondria is the powerhouse of the cell",
  metadata: { topic: "science" },
};

const ids = await vercelPostgresStore.addDocuments([
  docHello,
  docHi,
  docMitochondria,
]);

const results = await vercelPostgresStore.similaritySearch("hello", 2);
console.log(results);
/*
  [
    Document { pageContent: 'hello', metadata: { topic: 'nonsense' } },
    Document { pageContent: 'hi', metadata: { topic: 'nonsense' } }
  ]
*/

// Metadata filtering
const results2 = await vercelPostgresStore.similaritySearch(
  "Irrelevant query, metadata filtering",
  2,
  {
    topic: "science",
  }
);
console.log(results2);
/*
  [
    Document {
      pageContent: 'Mitochondria is the powerhouse of the cell',
      metadata: { topic: 'science' }
    }
  ]
*/

// Metadata filtering with IN-filters works as well
const results3 = await vercelPostgresStore.similaritySearch(
  "Irrelevant query, metadata filtering",
  3,
  {
    topic: { in: ["science", "nonsense"] },
  }
);
console.log(results3);
/*
  [
    Document {
      pageContent: 'hello',
      metadata: { topic: 'nonsense' }
    },
    Document {
      pageContent: 'hi',
      metadata: { topic: 'nonsense' }
    },
    Document {
      pageContent: 'Mitochondria is the powerhouse of the cell',
      metadata: { topic: 'science' }
    }
  ]
*/

// Upserting is supported as well
await vercelPostgresStore.addDocuments(
  [
    {
      pageContent: "ATP is the powerhouse of the cell",
      metadata: { topic: "science" },
    },
  ],
  { ids: [ids[2]] }
);

const results4 = await vercelPostgresStore.similaritySearch(
  "What is the powerhouse of the cell?",
  1
);
console.log(results4);
/*
  [
    Document {
      pageContent: 'ATP is the powerhouse of the cell',
      metadata: { topic: 'science' }
    }
  ]
*/

await vercelPostgresStore.delete({ ids: [ids[2]] });

const results5 = await vercelPostgresStore.similaritySearch(
  "No more metadata",
  2,
  {
    topic: "science",
  }
);
console.log(results5);
/*
  []
*/

// Remember to call .end() to close the connection!
await vercelPostgresStore.end();
