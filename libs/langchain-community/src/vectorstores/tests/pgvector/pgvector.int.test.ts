import { expect, test } from "@jest/globals";
import pg, { PoolConfig } from "pg";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore, PGVectorStoreArgs } from "../../pgvector.js";
// import { BedrockEmbeddings } from "../../../embeddings/bedrock.js";

const embeddingsEngine = new OpenAIEmbeddings();

// const embeddingsEngine = new BedrockEmbeddings({
//   region: "us-east-1",
// });

const postgresConnectionOptions = {
  type: "postgres",
  host: "127.0.0.1",
  port: 5432,
  user: "myuser",
  password: "ChangeMe",
  database: "api",
} as PoolConfig;

const documentsForFilterTest = [
  {
    pageContent: "Lorem Ipsum",
    metadata: {
      num: 100,
      string: "test1",
      bool: true,
    },
  },
  {
    pageContent: "Lorem Ipsum",
    metadata: {
      num: 200,
      string: "test2",
      bool: true,
    },
  },
  {
    pageContent: "Lorem Ipsum",
    metadata: {
      num: 300,
      string: "test3",
      bool: false,
    },
  },
];

const testFilters = async (pgvectorVectorStore: PGVectorStore) => {
  await pgvectorVectorStore.addDocuments(documentsForFilterTest);

  // 'in' test
  const result = await pgvectorVectorStore.similaritySearch("hello", 2, {
    num: {
      in: [100, 300],
    },
    bool: {
      in: [true, false],
    },
  });

  expect(result.length).toEqual(2);
  expect(result).toEqual([
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 100, bool: true }),
    },
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 300, bool: false }),
    },
  ]);

  // equality test
  const result2 = await pgvectorVectorStore.similaritySearch("hello", 2, {
    string: "test2",
    num: 200,
  });
  expect(result2.length).toEqual(1);
  expect(result2).toEqual([
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ string: "test2", num: 200 }),
    },
  ]);

  // equality test no results
  const result2a = await pgvectorVectorStore.similaritySearch("hello", 2, {
    string: "test2",
    num: 300,
  });
  expect(result2a.length).toEqual(0);

  // notIn test
  const result3 = await pgvectorVectorStore.similaritySearch("hello", 2, {
    num: {
      notIn: [100, 300],
    },
  });

  expect(result3.length).toEqual(1);
  expect(result3).toEqual([
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 200 }),
    },
  ]);

  // lt test
  const result4 = await pgvectorVectorStore.similaritySearch("hello", 2, {
    num: {
      lt: 200,
    },
  });

  expect(result4.length).toEqual(1);
  expect(result4).toEqual([
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 100 }),
    },
  ]);

  // lte test
  const result5 = await pgvectorVectorStore.similaritySearch("hello", 2, {
    num: {
      lte: 200,
    },
  });

  expect(result5.length).toEqual(2);
  expect(result5).toEqual([
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 100 }),
    },
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 200 }),
    },
  ]);

  // gt test
  const result6 = await pgvectorVectorStore.similaritySearch("hello", 2, {
    num: {
      gt: 200,
    },
  });

  expect(result6.length).toEqual(1);
  expect(result6).toEqual([
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 300 }),
    },
  ]);

  // gte test
  const result7 = await pgvectorVectorStore.similaritySearch("hello", 2, {
    num: {
      gte: 200,
    },
  });

  expect(result7.length).toEqual(2);
  expect(result7).toEqual([
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 200 }),
    },
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 300 }),
    },
  ]);

  // combination of gte and lte
  const result7a = await pgvectorVectorStore.similaritySearch("hello", 3, {
    num: {
      gte: 200,
      lte: 300,
    },
  });
  expect(result7a.length).toEqual(2);
  expect(result7a).toEqual([
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 200 }),
    },
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 300 }),
    },
  ]);

  // neq test
  const result8 = await pgvectorVectorStore.similaritySearch("hello", 2, {
    num: {
      neq: 200,
    },
  });

  expect(result8.length).toEqual(2);
  expect(result8).toEqual([
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 100 }),
    },
    {
      id: expect.any(String),
      pageContent: "Lorem Ipsum",
      metadata: expect.objectContaining({ num: 300 }),
    },
  ]);
};

describe("PGVectorStore", () => {
  let pgvectorVectorStore: PGVectorStore;
  const tableName = "testlangchain";

  beforeAll(async () => {
    const config: PGVectorStoreArgs = {
      postgresConnectionOptions,
      tableName: "testlangchain",
      // collectionTableName: "langchain_pg_collection",
      // collectionName: "langchain",
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    };

    pgvectorVectorStore = await PGVectorStore.initialize(
      embeddingsEngine,
      config
    );
  });

  afterEach(async () => {
    // Drop table, then recreate it for the next test.
    await pgvectorVectorStore.pool.query(`DROP TABLE "${tableName}"`);
    await pgvectorVectorStore.ensureTableInDatabase();
  });

  afterAll(async () => {
    await pgvectorVectorStore.end();
  });

  test("Test embeddings creation", async () => {
    const documents = [
      {
        pageContent: "hello",
        metadata: { a: 1 },
      },
      {
        pageContent: "Cat drinks milk",
        metadata: { a: 2 },
      },
      { pageContent: "hi", metadata: { a: 1 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);
    const results = await pgvectorVectorStore.similaritySearch("hello", 2, {
      a: 2,
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toEqual("Cat drinks milk");
  });

  test("Test MMR search", async () => {
    const documents = [
      {
        pageContent: "hello",
        metadata: { a: 1 },
      },
      {
        pageContent: "foo",
        metadata: { a: 2 },
      },
      { pageContent: "bye", metadata: { a: 1 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);
    const results = await pgvectorVectorStore.maxMarginalRelevanceSearch(
      "hello",
      {
        k: 4,
      }
    );

    expect(results).toHaveLength(3);
  });

  test("PGvector can save documents with a list greater than default chunk size", async () => {
    // Extract the default chunk size and add one.
    const docsToGenerate = pgvectorVectorStore.chunkSize + 1;
    const documents = [];
    for (let i = 1; i <= docsToGenerate; i += 1) {
      documents.push({ pageContent: "Lorem Ipsum", metadata: { a: i } });
    }
    await pgvectorVectorStore.addDocuments(documents);

    // Query the table to check the number of rows
    const result = await pgvectorVectorStore.pool.query(
      `SELECT COUNT(*) FROM "${tableName}"`
    );
    const rowCount = parseInt(result.rows[0].count, 10);
    // Check if the number of rows is equal to the number of documents added
    expect(rowCount).toEqual(docsToGenerate);
  });

  test("PGvector can save documents with ids", async () => {
    const id1 = "d8e70e98-19ab-4438-9c14-4bb2bb21a1f9";
    const id2 = "2bbb4b73-efec-4d5e-80ea-df94a4ed3aa3";

    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
    ];

    await pgvectorVectorStore.addDocuments(documents, { ids: [id1, id2] });

    const result = await pgvectorVectorStore.pool.query(
      `SELECT id FROM "${tableName}" WHERE id = $1`,
      [id1]
    );

    expect(result.rowCount).toEqual(1);
  });

  test("PGvector supports different filter types", async () => {
    await testFilters(pgvectorVectorStore);
  });

  test("PGvector supports arrayContains (?|) in metadata filter ", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: ["tag1", "tag2"] } },
      { pageContent: "Lorem Ipsum", metadata: { a: ["tag2"] } },
      { pageContent: "Lorem Ipsum", metadata: { a: ["tag1"] } },
    ];

    await pgvectorVectorStore.addDocuments(documents);

    const result = await pgvectorVectorStore.similaritySearch("hello", 2, {
      a: {
        arrayContains: ["tag1"],
      },
    });

    expect(result.length).toEqual(2);
    expect(result).toEqual([
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: ["tag1", "tag2"] },
      },
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: ["tag1"] },
      },
    ]);

    const result2 = await pgvectorVectorStore.similaritySearch("hello", 2, {
      a: {
        arrayContains: ["tag2"],
      },
    });
    expect(result2.length).toEqual(2);
    expect(result2).toEqual([
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: ["tag1", "tag2"] },
      },
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: ["tag2"] },
      },
    ]);

    const result3 = await pgvectorVectorStore.similaritySearch("hello", 3);

    expect(result3.length).toEqual(3);
    expect(result3).toEqual(
      documents.map((doc) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-param-reassign
        (doc as any).id = expect.any(String);
        return doc;
      })
    );
  });

  test("PGvector can delete document by id", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 3 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);

    const result = await pgvectorVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    const initialIds = result.rows.map((row) => row.id);
    const firstIdToDelete = initialIds[0];
    const secondIdToDelete = initialIds[1];
    const idToKeep = initialIds[2];

    await pgvectorVectorStore.delete({
      ids: [firstIdToDelete, secondIdToDelete],
    });

    const result2 = await pgvectorVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    // Only one row should be left
    expect(result2.rowCount).toEqual(1);

    // The deleted ids should not be in the result
    const idsAfterDelete = result2.rows.map((row) => row.id);
    expect(idsAfterDelete).not.toContain(firstIdToDelete);
    expect(idsAfterDelete).not.toContain(secondIdToDelete);

    expect(idsAfterDelete).toContain(idToKeep);
  });

  test("PGvector can delete document by metadata", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 1, c: 1 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);
    const result = await pgvectorVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    const initialIds = result.rows.map((row) => row.id);

    // Filter Matches 1st document
    // Use complex filters here to test the various operators at the same time
    await pgvectorVectorStore.delete({
      filter: { a: 1, b: { gte: 1 }, c: { neq: 2 } },
    });

    const result2 = await pgvectorVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    // Two rows should be left
    expect(result2.rowCount).toEqual(2);

    const idsAfterDelete = result2.rows.map((row) => row.id);

    // The document with matching metadata should not be in the database
    expect(idsAfterDelete).not.toContainEqual(initialIds[0]);

    // All other documents should still be in database
    expect(idsAfterDelete).toContainEqual(initialIds[1]);
    expect(idsAfterDelete).toContainEqual(initialIds[2]);
  });

  test.skip("PGvector supports different vector types", async () => {
    // verify by asserting different pgvector operators based on vector type
    pgvectorVectorStore.distanceStrategy = "cosine";
    expect(pgvectorVectorStore.computedOperatorString).toEqual("<=>");

    pgvectorVectorStore.distanceStrategy = "innerProduct";
    expect(pgvectorVectorStore.computedOperatorString).toEqual("<#>");

    pgvectorVectorStore.distanceStrategy = "euclidean";
    expect(pgvectorVectorStore.computedOperatorString).toEqual("<->");

    // verify with extensionSchemaName
    pgvectorVectorStore.distanceStrategy = "cosine";
    pgvectorVectorStore.extensionSchemaName = "schema1";
    expect(pgvectorVectorStore.computedOperatorString).toEqual(
      "OPERATOR(schema1.<=>)"
    );

    pgvectorVectorStore.distanceStrategy = "innerProduct";
    pgvectorVectorStore.extensionSchemaName = "schema2";
    expect(pgvectorVectorStore.computedOperatorString).toEqual(
      "OPERATOR(schema2.<#>)"
    );

    pgvectorVectorStore.distanceStrategy = "euclidean";
    pgvectorVectorStore.extensionSchemaName = "schema3";
    expect(pgvectorVectorStore.computedOperatorString).toEqual(
      "OPERATOR(schema3.<->)"
    );
  });
});

describe("PGVectorStore with collection", () => {
  let pgvectorVectorStore: PGVectorStore;
  const tableName = "testlangchain_collection";
  const collectionTableName = "langchain_pg_collection";

  beforeAll(async () => {
    const config = {
      postgresConnectionOptions,
      tableName,
      collectionTableName,
      collectionName: "langchain",
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    };

    pgvectorVectorStore = await PGVectorStore.initialize(
      embeddingsEngine,
      config
    );
  });

  afterEach(async () => {
    // Drop table, then recreate it for the next test.
    await pgvectorVectorStore.pool.query(`DROP TABLE "${tableName}"`);
    await pgvectorVectorStore.pool.query(
      `DROP TABLE ${pgvectorVectorStore.computedCollectionTableName}`
    );
    await pgvectorVectorStore.ensureTableInDatabase();
    await pgvectorVectorStore.ensureCollectionTableInDatabase();
  });

  afterAll(async () => {
    await pgvectorVectorStore.end();
  });

  test("'name' column is indexed", async () => {
    const result = await pgvectorVectorStore.pool.query(
      `SELECT * FROM pg_indexes WHERE tablename = '${pgvectorVectorStore.computedCollectionTableName}'`
    );
    const expectedIndexName = `idx_${pgvectorVectorStore.computedCollectionTableName}_name`;

    const index = result.rows.find(
      (row) => row.indexname === expectedIndexName
    );
    expect(index).toBeDefined();
  });

  test("Test embeddings creation", async () => {
    const documents = [
      {
        pageContent: "hello",
        metadata: { a: 1 },
      },
      {
        pageContent: "Cat drinks milk",
        metadata: { a: 2 },
      },
      { pageContent: "hi", metadata: { a: 1 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);
    const results = await pgvectorVectorStore.similaritySearch("hello", 2, {
      a: 2,
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toEqual("Cat drinks milk");
  });

  test("PGvector can save documents with a list greater than default chunk size", async () => {
    // Extract the default chunk size and add one.
    const docsToGenerate = pgvectorVectorStore.chunkSize + 1;
    const documents = [];
    for (let i = 1; i <= docsToGenerate; i += 1) {
      documents.push({ pageContent: "Lorem Ipsum", metadata: { a: i } });
    }
    await pgvectorVectorStore.addDocuments(documents);

    // Query the table to check the number of rows
    const result = await pgvectorVectorStore.pool.query(
      `SELECT COUNT(*) FROM "${tableName}"`
    );
    const rowCount = parseInt(result.rows[0].count, 10);
    // Check if the number of rows is equal to the number of documents added
    expect(rowCount).toEqual(docsToGenerate);
  });

  test("PGvector can save documents with ids", async () => {
    const id1 = "d8e70e98-19ab-4438-9c14-4bb2bb21a1f9";
    const id2 = "2bbb4b73-efec-4d5e-80ea-df94a4ed3aa3";

    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
    ];

    await pgvectorVectorStore.addDocuments(documents, { ids: [id1, id2] });

    const result = await pgvectorVectorStore.pool.query(
      `SELECT id FROM "${tableName}" WHERE id = $1`,
      [id1]
    );

    expect(result.rowCount).toEqual(1);
  });

  test("PGvector supports different filter types", async () => {
    await testFilters(pgvectorVectorStore);
  });

  test("PGvector can delete document by id", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 3 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);

    const result = await pgvectorVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    const initialIds = result.rows.map((row) => row.id);
    const firstIdToDelete = initialIds[0];
    const secondIdToDelete = initialIds[1];
    const idToKeep = initialIds[2];

    await pgvectorVectorStore.delete({
      ids: [firstIdToDelete, secondIdToDelete],
    });

    const result2 = await pgvectorVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    // Only one row should be left
    expect(result2.rowCount).toEqual(1);

    // The deleted ids should not be in the result
    const idsAfterDelete = result2.rows.map((row) => row.id);
    expect(idsAfterDelete).not.toContain(firstIdToDelete);
    expect(idsAfterDelete).not.toContain(secondIdToDelete);

    expect(idsAfterDelete).toContain(idToKeep);
  });

  test("PGvector can delete document by metadata", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 1, c: 1 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);
    const result = await pgvectorVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    const initialIds = result.rows.map((row) => row.id);

    // Filter Matches 1st document
    // Use complex filters here to test the various operators at the same time
    await pgvectorVectorStore.delete({
      filter: { a: 1, b: { gte: 1 }, c: { neq: 2 } },
    });

    const result2 = await pgvectorVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    // Two rows should be left
    expect(result2.rowCount).toEqual(2);

    const idsAfterDelete = result2.rows.map((row) => row.id);

    // The document with matching metadata should not be in the database
    expect(idsAfterDelete).not.toContainEqual(initialIds[0]);

    // All other documents should still be in database
    expect(idsAfterDelete).toContainEqual(initialIds[1]);
    expect(idsAfterDelete).toContainEqual(initialIds[2]);
  });
});

describe("PGVectorStore with schema", () => {
  let pgvectorVectorStore: PGVectorStore;
  const tableName = "testlangchain_schema";
  const schema = "test_schema";
  const collectionTableName = "langchain_pg_collection_schema";
  let computedTableName: string;
  let computedCollectionTableName: string;
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool(postgresConnectionOptions);

    const config: PGVectorStoreArgs = {
      pool,
      tableName,
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
      collectionTableName,
      collectionName: "langchain",
      schemaName: schema,
    };

    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

    pgvectorVectorStore = await PGVectorStore.initialize(
      embeddingsEngine,
      config
    );
    computedTableName = pgvectorVectorStore.computedTableName;
    computedCollectionTableName =
      pgvectorVectorStore.computedCollectionTableName;
  });

  afterEach(async () => {
    // Drop table, then recreate it for the next test.
    await pgvectorVectorStore.pool.query(`DROP TABLE ${computedTableName}`);
    await pgvectorVectorStore.pool.query(
      `DROP TABLE ${computedCollectionTableName}`
    );
    await pgvectorVectorStore.ensureTableInDatabase();
    await pgvectorVectorStore.ensureCollectionTableInDatabase();
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pgvectorVectorStore.end();
  });

  test("Test table creation with schema", async () => {
    const result = await pgvectorVectorStore.pool.query(
      `SELECT table_schema FROM information_schema.tables WHERE table_name = '${tableName}' AND table_schema = '${schema}'`
    );

    expect(result.rowCount).toEqual(1);

    const result2 = await pgvectorVectorStore.pool.query(
      `SELECT table_schema FROM information_schema.tables WHERE table_name = '${collectionTableName}' AND table_schema = '${schema}'`
    );

    expect(result2.rowCount).toEqual(1);
  });

  test("Test embeddings creation", async () => {
    const documents = [
      {
        pageContent: "hello",
        metadata: { a: 1 },
      },
      {
        pageContent: "Cat drinks milk",
        metadata: { a: 2 },
      },
      { pageContent: "hi", metadata: { a: 1 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);
    const results = await pgvectorVectorStore.similaritySearch("hello", 2, {
      a: 2,
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toEqual("Cat drinks milk");
  });

  test("PGvector can save documents with a list greater than default chunk size", async () => {
    // Extract the default chunk size and add one.
    const docsToGenerate = pgvectorVectorStore.chunkSize + 1;
    const documents = [];
    for (let i = 1; i <= docsToGenerate; i += 1) {
      documents.push({ pageContent: "Lorem Ipsum", metadata: { a: i } });
    }
    await pgvectorVectorStore.addDocuments(documents);

    // Query the table to check the number of rows
    const result = await pgvectorVectorStore.pool.query(
      `SELECT COUNT(*) FROM ${computedTableName}`
    );
    const rowCount = parseInt(result.rows[0].count, 10);
    // Check if the number of rows is equal to the number of documents added
    expect(rowCount).toEqual(docsToGenerate);
  });

  test("PGvector can save documents with ids", async () => {
    const id1 = "d8e70e98-19ab-4438-9c14-4bb2bb21a1f9";
    const id2 = "2bbb4b73-efec-4d5e-80ea-df94a4ed3aa3";

    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
    ];

    await pgvectorVectorStore.addDocuments(documents, { ids: [id1, id2] });

    const result = await pgvectorVectorStore.pool.query(
      `SELECT id FROM ${computedTableName} WHERE id = $1`,
      [id1]
    );

    expect(result.rowCount).toEqual(1);
  });

  test("PGvector supports different filter types", async () => {
    await testFilters(pgvectorVectorStore);
  });

  test("PGvector can delete document by id", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 3 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);

    const result = await pgvectorVectorStore.pool.query(
      `SELECT id FROM ${computedTableName}`
    );

    const initialIds = result.rows.map((row) => row.id);
    const firstIdToDelete = initialIds[0];
    const secondIdToDelete = initialIds[1];
    const idToKeep = initialIds[2];

    await pgvectorVectorStore.delete({
      ids: [firstIdToDelete, secondIdToDelete],
    });

    const result2 = await pgvectorVectorStore.pool.query(
      `SELECT id FROM ${computedTableName}`
    );

    // Only one row should be left
    expect(result2.rowCount).toEqual(1);

    // The deleted ids should not be in the result
    const idsAfterDelete = result2.rows.map((row) => row.id);
    expect(idsAfterDelete).not.toContain(firstIdToDelete);
    expect(idsAfterDelete).not.toContain(secondIdToDelete);

    expect(idsAfterDelete).toContain(idToKeep);
  });

  test("PGvector can delete document by metadata", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 1, c: 1 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);
    const result = await pgvectorVectorStore.pool.query(
      `SELECT id FROM ${computedTableName}`
    );

    const initialIds = result.rows.map((row) => row.id);

    // Filter Matches 1st document
    // Use complex filters here to test the various operators at the same time
    await pgvectorVectorStore.delete({
      filter: { a: 1, c: { in: [1] } },
    });

    const result2 = await pgvectorVectorStore.pool.query(
      `SELECT id FROM ${computedTableName}`
    );

    // Two rows should be left
    expect(result2.rowCount).toEqual(2);

    const idsAfterDelete = result2.rows.map((row) => row.id);

    // The document with matching metadata should not be in the database
    expect(idsAfterDelete).not.toContainEqual(initialIds[2]);

    // All other documents should still be in database
    expect(idsAfterDelete).toContainEqual(initialIds[0]);
    expect(idsAfterDelete).toContainEqual(initialIds[1]);
  });
});

describe("PGVectorStore with skipInitializationCheck", () => {
  let pgvectorVectorStore: PGVectorStore;
  const tableName = "testlangchain_skip_init";

  afterEach(async () => {
    const pool = new pg.Pool(postgresConnectionOptions);
    await pool.query(`DROP TABLE IF EXISTS "${tableName}"`);
    await pool.end();
  });

  test("skipInitializationCheck=false (default) should initialize tables", async () => {
    const config: PGVectorStoreArgs = {
      postgresConnectionOptions,
      tableName,
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    };

    pgvectorVectorStore = await PGVectorStore.initialize(
      embeddingsEngine,
      config
    );

    const result = await pgvectorVectorStore.pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      )`
    );

    expect(result.rows[0].exists).toBe(true);
    await pgvectorVectorStore.end();
  });

  test("skipInitializationCheck=true should skip table initialization", async () => {
    const config: PGVectorStoreArgs = {
      postgresConnectionOptions,
      tableName,
      skipInitializationCheck: true,
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    };

    pgvectorVectorStore = await PGVectorStore.initialize(
      embeddingsEngine,
      config
    );

    const tableExists = await pgvectorVectorStore.pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      )`
    );

    expect(tableExists.rows[0].exists).toBe(false);

    await pgvectorVectorStore.end();
  });

  test("skipInitializationCheck=true should work with addDocuments", async () => {
    const setupPool = new pg.Pool(postgresConnectionOptions);

    await setupPool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await setupPool.query(`
      CREATE TABLE "${tableName}" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        "content" text,
        "metadata" jsonb,
        "vector" vector(1536)
      );
    `);

    await setupPool.end();

    const config: PGVectorStoreArgs = {
      postgresConnectionOptions,
      tableName,
      skipInitializationCheck: true,
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    };

    pgvectorVectorStore = await PGVectorStore.initialize(
      embeddingsEngine,
      config
    );

    const documents = [
      { pageContent: "Hello world", metadata: { source: "test" } },
      {
        pageContent: "Testing skipInitializationCheck",
        metadata: { source: "test" },
      },
    ];

    await pgvectorVectorStore.addDocuments(documents);

    const query = await embeddingsEngine.embedQuery("Hello");
    const results = await pgvectorVectorStore.similaritySearchVectorWithScore(
      query,
      1
    );

    expect(results).toHaveLength(1);
    expect(results[0][0].pageContent).toBe("Hello world");

    await pgvectorVectorStore.end();
  });
});

describe("PGVectorStore with HNSW index", () => {
  let pgvectorVectorStore: PGVectorStore;
  const tableName = "testlangchain";

  beforeAll(async () => {
    const config: PGVectorStoreArgs = {
      postgresConnectionOptions,
      tableName: "testlangchain",
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
      distanceStrategy: "cosine",
    };

    pgvectorVectorStore = await PGVectorStore.initialize(
      embeddingsEngine,
      config
    );

    // Create the index
    await pgvectorVectorStore.createHnswIndex({ dimensions: 1536 });
  });

  afterEach(async () => {
    // Drop table, then recreate it for the next test.
    await pgvectorVectorStore.pool.query(`DROP TABLE "${tableName}"`);
    await pgvectorVectorStore.ensureTableInDatabase();
    await pgvectorVectorStore.createHnswIndex({ dimensions: 1536 });
  });

  afterAll(async () => {
    await pgvectorVectorStore.end();
  });

  test("Ensure table has HNSW index", async () => {
    const result = await pgvectorVectorStore.pool.query(
      `SELECT indexname, tablename, indexdef FROM pg_indexes where indexname='vector_embedding_hnsw_idx';`
    );
    const { indexdef } = result.rows[0];
    expect(result.rowCount).toBe(1);
    expect(indexdef.includes("USING hnsw")).toBe(true);
  });

  test("Test embeddings creation", async () => {
    const documents = [
      {
        pageContent: "hello",
        metadata: { a: 1 },
      },
      {
        pageContent: "Cat drinks milk",
        metadata: { a: 2 },
      },
      { pageContent: "hi", metadata: { a: 1 } },
    ];
    await pgvectorVectorStore.addDocuments(documents);

    const query = await embeddingsEngine.embedQuery("milk");
    const results = await pgvectorVectorStore.similaritySearchVectorWithScore(
      query,
      1
    );

    expect(results).toHaveLength(1);
    expect(results[0][0].pageContent).toEqual("Cat drinks milk");
  });
});
