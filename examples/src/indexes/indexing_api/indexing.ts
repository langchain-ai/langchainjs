import { PostgresRecordManager } from "@langchain/community/indexes/recordmanagers/postgres";
// import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { index } from "langchain/indexes";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { FakeEmbeddings } from "langchain/embeddings/fake";
import { PoolConfig } from "pg";

// See python version for more details
// https://python.langchain.com/docs/modules/data_connection/indexing

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/pgvector

const config = {
  postgresConnectionOptions: {
    type: "postgres",
    host: "127.0.0.1",
    port: 5432,
    user: "myuser",
    password: "ChangeMe",
    database: "api",
  } as PoolConfig,
  tableName: "testlangchain",
  columns: {
    idColumnName: "id",
    vectorColumnName: "vector",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
};

const vectorstore = await PGVectorStore.initialize(
  new FakeEmbeddings(),
  config
);

// Create a new record manager
const recordManagerConfig = {
  postgresConnectionOptions: {
    type: "postgres",
    host: "127.0.0.1",
    port: 5432,
    user: "myuser",
    password: "ChangeMe",
    database: "api",
  } as PoolConfig,
  tableName: "upsertion_records",
  namespace: "test_namespace",
};
const recordManager = new PostgresRecordManager(recordManagerConfig);

// Create the schema if it doesn't exist
await recordManager.createSchema();

// Index some documents
const doc1 = {
  pageContent: "kitty",
  metadata: { source: "kitty.txt" },
};

const doc2 = {
  pageContent: "doggy",
  metadata: { source: "doggy.txt" },
};

/**
 * Hacky helper method to clear content. See the `full` mode section to to understand why it works.
 */
async function clear() {
  await index([], recordManager, vectorstore, {
    cleanup: "full",
    sourceIdKey: "source",
  });
}

// No cleanup
await clear();

// This mode does not do automatic clean up of old versions of content; however, it still takes care of content de-duplication.

console.log(
  await index(
    [doc1, doc1, doc1, doc1, doc1, doc1],
    recordManager,
    vectorstore,
    {
      cleanup: undefined,
      sourceIdKey: "source",
    }
  )
);

/*
    {
        numAdded: 1,
        numUpdated: 0,
        numDeleted: 0,
        numSkipped: 0,
    }
*/

await clear();

console.log(
  await index([doc1, doc2], recordManager, vectorstore, {
    cleanup: undefined,
    sourceIdKey: "source",
  })
);

/*
    {
        numAdded: 2,
        numUpdated: 0,
        numDeleted: 0,
        numSkipped: 0,
    }
*/

// Second time around all content will be skipped

console.log(
  await index([doc1, doc2], recordManager, vectorstore, {
    cleanup: undefined,
    sourceIdKey: "source",
  })
);

/*
    {
        numAdded: 0,
        numUpdated: 0,
        numDeleted: 0,
        numSkipped: 2,
    }
*/

// Updated content will be added, but old won't be deleted

const doc1Updated = {
  pageContent: "kitty updated",
  metadata: { source: "kitty.txt" },
};

console.log(
  await index([doc1Updated, doc2], recordManager, vectorstore, {
    cleanup: undefined,
    sourceIdKey: "source",
  })
);

/*
    {
        numAdded: 1,
        numUpdated: 0,
        numDeleted: 0,
        numSkipped: 1,
    }
*/

/*
Resulting records in the database:
    [
        {
            pageContent: "kitty",
            metadata: { source: "kitty.txt" },
        },
        {
            pageContent: "doggy",
            metadata: { source: "doggy.txt" },
        },
        {
            pageContent: "kitty updated",
            metadata: { source: "kitty.txt" },
        }
    ]
*/

// Incremental mode
await clear();

console.log(
  await index([doc1, doc2], recordManager, vectorstore, {
    cleanup: "incremental",
    sourceIdKey: "source",
  })
);

/*
    {
        numAdded: 2,
        numUpdated: 0,
        numDeleted: 0,
        numSkipped: 0,
    }
*/

// Indexing again should result in both documents getting skipped – also skipping the embedding operation!

console.log(
  await index([doc1, doc2], recordManager, vectorstore, {
    cleanup: "incremental",
    sourceIdKey: "source",
  })
);

/*
    {
        numAdded: 0,
        numUpdated: 0,
        numDeleted: 0,
        numSkipped: 2,
    }
*/

// If we provide no documents with incremental indexing mode, nothing will change.
console.log(
  await index([], recordManager, vectorstore, {
    cleanup: "incremental",
    sourceIdKey: "source",
  })
);

/*
    {
        numAdded: 0,
        numUpdated: 0,
        numDeleted: 0,
        numSkipped: 0,
    }
*/

// If we mutate a document, the new version will be written and all old versions sharing the same source will be deleted.
// This only affects the documents with the same source id!

const changedDoc1 = {
  pageContent: "kitty updated",
  metadata: { source: "kitty.txt" },
};
console.log(
  await index([changedDoc1], recordManager, vectorstore, {
    cleanup: "incremental",
    sourceIdKey: "source",
  })
);

/*
    {
        numAdded: 1,
        numUpdated: 0,
        numDeleted: 1,
        numSkipped: 0,
    }
*/

// Full mode
await clear();
// In full mode the user should pass the full universe of content that should be indexed into the indexing function.

// Any documents that are not passed into the indexing function and are present in the vectorstore will be deleted!

// This behavior is useful to handle deletions of source documents.
const allDocs = [doc1, doc2];
console.log(
  await index(allDocs, recordManager, vectorstore, {
    cleanup: "full",
    sourceIdKey: "source",
  })
);

/*
    {
        numAdded: 2,
        numUpdated: 0,
        numDeleted: 0,
        numSkipped: 0,
    }
*/

// Say someone deleted the first doc:

const doc2Only = [doc2];

// Using full mode will clean up the deleted content as well.
// This afffects all documents regardless of source id!

console.log(
  await index(doc2Only, recordManager, vectorstore, {
    cleanup: "full",
    sourceIdKey: "source",
  })
);

/*
    {
        numAdded: 0,
        numUpdated: 0,
        numDeleted: 1,
        numSkipped: 1,
    }
*/

await recordManager.end();
await vectorstore.end();
