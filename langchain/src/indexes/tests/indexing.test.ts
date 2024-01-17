import { InMemoryRecordManager } from "@langchain/community/indexes/recordmanagers/memory";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { Document } from "@langchain/core/documents";
import { type PoolConfig } from "pg";

import { FakeEmbeddings } from "../../embeddings/fake.js";
import { index } from "../indexing.js";

describe("Indexing API", () => {
  let recordManager: InMemoryRecordManager;
  let vectorstore: PGVectorStore;
  const tableName = "testlangchain";

  beforeAll(async () => {
    const config = {
      postgresConnectionOptions: {
        type: "postgres",
        host: "127.0.0.1",
        port: 5432,
        user: "myuser",
        password: "ChangeMe",
        database: "api",
      } as PoolConfig,
      tableName,
    };
    recordManager = new InMemoryRecordManager();

    await recordManager.createSchema();
    vectorstore = await PGVectorStore.initialize(new FakeEmbeddings(), config);
  });

  afterEach(async () => {
    recordManager.records.clear();
    await vectorstore.pool.query(`DROP TABLE "${tableName}"`);
    await vectorstore.ensureTableInDatabase();
  });

  afterAll(async () => {
    await vectorstore.end();
  });

  test("Test indexing sanity", async () => {
    const docs = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    const initialIndexingResult = await index(
      docs,
      recordManager,
      vectorstore,
      {}
    );

    expect(initialIndexingResult.numAdded).toEqual(3);

    const secondIndexingResult = await index(
      docs,
      recordManager,
      vectorstore,
      {}
    );
    expect(secondIndexingResult.numAdded).toEqual(0);
    expect(secondIndexingResult.numSkipped).toEqual(3);

    const res = await vectorstore.pool.query(`SELECT * FROM "${tableName}"`);
    expect(recordManager.records.size).toEqual(3);
    expect(res.rowCount).toEqual(3);
  });

  test("Test indexing with cleanup full", async () => {
    const docs = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index(docs, recordManager, vectorstore, { cleanup: "full" });

    const secondIndexingResult = await index([], recordManager, vectorstore, {
      cleanup: "full",
    });
    expect(secondIndexingResult.numAdded).toEqual(0);
    expect(secondIndexingResult.numSkipped).toEqual(0);
    expect(secondIndexingResult.numDeleted).toEqual(3);

    const res = await vectorstore.pool.query(`SELECT * FROM "${tableName}"`);
    expect(recordManager.records.size).toEqual(0);
    expect(res.rowCount).toEqual(0);
  });

  test("Test indexing with updated page content (full)", async () => {
    const docs = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index(docs, recordManager, vectorstore, {
      cleanup: "full",
    });

    docs[0].pageContent = "Document 1 Content Updated";

    const secondIndexingResult = await index(docs, recordManager, vectorstore, {
      cleanup: "full",
    });
    expect(secondIndexingResult.numAdded).toEqual(1);
    expect(secondIndexingResult.numDeleted).toEqual(1);
    expect(secondIndexingResult.numSkipped).toEqual(2);

    const res = await vectorstore.pool.query(`SELECT * FROM "${tableName}"`);
    expect(recordManager.records.size).toEqual(3);
    expect(res.rowCount).toEqual(3);
  });

  test("Test indexing with updated metadata (full)", async () => {
    const docs: Document[] = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index(docs, recordManager, vectorstore, {
      cleanup: "full",
    });

    docs[0].metadata.field = "value";

    const secondIndexingResult = await index(docs, recordManager, vectorstore, {
      cleanup: "full",
    });
    expect(secondIndexingResult.numAdded).toEqual(1);
    expect(secondIndexingResult.numDeleted).toEqual(1);
    expect(secondIndexingResult.numSkipped).toEqual(2);
  });

  test("Test indexing with updated page content (incremental)", async () => {
    const docs = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index(docs, recordManager, vectorstore, {
      cleanup: "incremental",
      sourceIdKey: "source",
    });

    docs[0].pageContent = "Document 1 Content Updated";

    const secondIndexingResult = await index(docs, recordManager, vectorstore, {
      cleanup: "incremental",
      sourceIdKey: "source",
    });
    expect(secondIndexingResult.numAdded).toEqual(1);
    expect(secondIndexingResult.numDeleted).toEqual(1);
    expect(secondIndexingResult.numSkipped).toEqual(2);

    const res = await vectorstore.pool.query(`SELECT * FROM "${tableName}"`);
    expect(recordManager.records.size).toEqual(3);
    expect(res.rowCount).toEqual(3);
  });

  test("Test indexing with updated metadata (incremental)", async () => {
    const docs: Document[] = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index(docs, recordManager, vectorstore, {
      cleanup: "incremental",
      sourceIdKey: "source",
    });

    docs[0].metadata.field = "value";

    const secondIndexingResult = await index(docs, recordManager, vectorstore, {
      cleanup: "incremental",
      sourceIdKey: "source",
    });
    expect(secondIndexingResult.numAdded).toEqual(1);
    expect(secondIndexingResult.numDeleted).toEqual(1);
    expect(secondIndexingResult.numSkipped).toEqual(2);
  });

  test("Test indexing with updated page content without cleanup", async () => {
    const docs: Document[] = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index(docs, recordManager, vectorstore);

    docs[0].pageContent = "Document 1 Content Updated";

    const secondIndexingResult = await index(docs, recordManager, vectorstore);
    expect(secondIndexingResult.numAdded).toEqual(1);
    expect(secondIndexingResult.numDeleted).toEqual(0);
    expect(secondIndexingResult.numSkipped).toEqual(2);
  });

  test("Test indexing with forced update", async () => {
    const docs: Document[] = [
      {
        pageContent: "Document 1 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 2 Content",
        metadata: { source: "test" },
      },
      {
        pageContent: "Document 3 Content",
        metadata: { source: "test" },
      },
    ];

    await index(docs, recordManager, vectorstore, {
      cleanup: "full",
    });

    // Force update is mostly useful when you are re-indexing with updated embeddings.
    // Some vector stores (such as PGVectorStore) do not support overwriting records
    // and will throw an error if you try to do so. We must therefore delete the records
    // before re-indexing.
    await vectorstore.pool.query(`DELETE FROM "${tableName}"`);

    const secondIndexingResult = await index(docs, recordManager, vectorstore, {
      cleanup: "full",
      forceUpdate: true,
    });

    expect(secondIndexingResult.numAdded).toEqual(0);
    expect(secondIndexingResult.numDeleted).toEqual(0);
    expect(secondIndexingResult.numUpdated).toEqual(3);
  });
});
