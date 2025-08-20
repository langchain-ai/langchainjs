import { expect, test } from "@jest/globals";
import pg, { PoolConfig } from "pg";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import {
  VastbaseVectorStore,
  VastbaseVectorStoreArgs,
} from "../vectorstores.js";
// import { BedrockEmbeddings } from "../../../embeddings/bedrock.js";

const embeddingsEngine = new SyntheticEmbeddings({
  vectorSize: 1024,
});

// const embeddingsEngine = new BedrockEmbeddings({
//   region: "us-east-1",
// });

const vastbaseConnectionOptions = {
  type: "vastbase",
  host: "host.docker.internal",
  port: 5438,
  user: "test",
  password: "Test@1234",
  database: "api",
} as PoolConfig;

describe("VastbaseVectorStore", () => {
  let vastbaseVectorStore: VastbaseVectorStore;
  const tableName = "testlangchain";

  beforeAll(async () => {
    const config: VastbaseVectorStoreArgs = {
      vastbaseConnectionOptions,
      tableName: "testlangchain",
      // collectionTableName: "langchain_vb_collection",
      // collectionName: "langchain",
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    };

    vastbaseVectorStore = await VastbaseVectorStore.initialize(
      embeddingsEngine,
      { ...config, dimensions: 1024 } // Specify dimensions for the vector column
    );
  });

  afterEach(async () => {
    // Drop table, then recreate it for the next test.
    await vastbaseVectorStore.pool.query(`DROP TABLE "${tableName}"`);
    await vastbaseVectorStore.ensureTableInDatabase(1024);
  });

  afterAll(async () => {
    await vastbaseVectorStore.end();
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
    await vastbaseVectorStore.addDocuments(documents);
    const results = await vastbaseVectorStore.similaritySearch("hello", 2, {
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
    await vastbaseVectorStore.addDocuments(documents);
    const results = await vastbaseVectorStore.maxMarginalRelevanceSearch(
      "hello",
      {
        k: 4,
      }
    );

    expect(results).toHaveLength(3);
  });

  test("Vastbase can save documents with a list greater than default chunk size", async () => {
    // Extract the default chunk size and add one.
    const docsToGenerate = vastbaseVectorStore.chunkSize + 1;
    const documents = [];
    for (let i = 1; i <= docsToGenerate; i += 1) {
      documents.push({ pageContent: "Lorem Ipsum", metadata: { a: i } });
    }
    await vastbaseVectorStore.addDocuments(documents);
    console.log(`Adding ${docsToGenerate} documents to Vastbase.`);
    // Query the table to check the number of rows
    const result = await vastbaseVectorStore.pool.query(
      `SELECT COUNT(*) FROM "${tableName}"`
    );
    const rowCount = parseInt(result.rows[0].count, 10);
    // Check if the number of rows is equal to the number of documents added
    expect(rowCount).toEqual(docsToGenerate);
  });

  test("Vastbase can save documents with ids", async () => {
    const id1 = "d8e70e98-19ab-4438-9c14-4bb2bb21a1f9";
    const id2 = "2bbb4b73-efec-4d5e-80ea-df94a4ed3aa3";

    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
    ];

    await vastbaseVectorStore.addDocuments(documents, { ids: [id1, id2] });

    const result = await vastbaseVectorStore.pool.query(
      `SELECT id FROM "${tableName}" WHERE id = $1`,
      [id1]
    );

    expect(result.rowCount).toEqual(1);
  });

  test("Vastbase supports different filter types", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 100 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 200 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 300 } },
    ];

    await vastbaseVectorStore.addDocuments(documents);

    const result = await vastbaseVectorStore.similaritySearch("hello", 2, {
      a: {
        in: [100, 300],
      },
    });

    expect(result.length).toEqual(2);
    expect(result).toEqual([
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: 100 },
      },
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: 300 },
      },
    ]);

    const result2 = await vastbaseVectorStore.similaritySearch("hello", 2, {
      a: 200,
    });
    expect(result2.length).toEqual(1);
    expect(result2).toEqual([
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: 200 },
      },
    ]);

    const result3 = await vastbaseVectorStore.similaritySearch("hello", 3);

    expect(result3.length).toEqual(3);

    const result4 = await vastbaseVectorStore.similaritySearch("hello", 2, {
      a: {
        notIn: [100, 300],
      },
    });

    expect(result4.length).toEqual(1);
    expect(result4).toEqual([
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: 200 },
      },
    ]);
  });

  test("Vastbase supports arrayContains (?|) in metadata filter ", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: ["tag1", "tag2"] } },
      { pageContent: "Lorem Ipsum", metadata: { a: ["tag2"] } },
      { pageContent: "Lorem Ipsum", metadata: { a: ["tag1"] } },
    ];

    await vastbaseVectorStore.addDocuments(documents);

    const result = await vastbaseVectorStore.similaritySearch("hello", 2, {
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

    const result2 = await vastbaseVectorStore.similaritySearch("hello", 2, {
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

    const result3 = await vastbaseVectorStore.similaritySearch("hello", 3);

    expect(result3.length).toEqual(3);
    expect(result3).toEqual(
      documents.map((doc) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-param-reassign
        (doc as any).id = expect.any(String);
        return doc;
      })
    );
  });

  test("Vastbase can delete document by id", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 3 } },
    ];
    await vastbaseVectorStore.addDocuments(documents);

    const result = await vastbaseVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    const initialIds = result.rows.map((row) => row.id);
    const firstIdToDelete = initialIds[0];
    const secondIdToDelete = initialIds[1];
    const idToKeep = initialIds[2];

    await vastbaseVectorStore.delete({
      ids: [firstIdToDelete, secondIdToDelete],
    });

    const result2 = await vastbaseVectorStore.pool.query(
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

  test("Vastbase can delete document by metadata", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 1, c: 1 } },
    ];
    await vastbaseVectorStore.addDocuments(documents);
    const result = await vastbaseVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    const initialIds = result.rows.map((row) => row.id);

    // Filter Matches 1st document
    await vastbaseVectorStore.delete({ filter: { a: 1, b: 1 } });

    const result2 = await vastbaseVectorStore.pool.query(
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

  test.skip("Vastbase supports different vector types", async () => {
    // verify by asserting different vastbase operators based on vector type
    vastbaseVectorStore.distanceStrategy = "cosine";
    expect(vastbaseVectorStore.computedOperatorString).toEqual("<=>");

    vastbaseVectorStore.distanceStrategy = "innerProduct";
    expect(vastbaseVectorStore.computedOperatorString).toEqual("<#>");

    vastbaseVectorStore.distanceStrategy = "euclidean";
    expect(vastbaseVectorStore.computedOperatorString).toEqual("<->");

    // verify with extensionSchemaName
    vastbaseVectorStore.distanceStrategy = "cosine";
    vastbaseVectorStore.extensionSchemaName = "schema1";
    expect(vastbaseVectorStore.computedOperatorString).toEqual(
      "OPERATOR(schema1.<=>)"
    );

    vastbaseVectorStore.distanceStrategy = "innerProduct";
    vastbaseVectorStore.extensionSchemaName = "schema2";
    expect(vastbaseVectorStore.computedOperatorString).toEqual(
      "OPERATOR(schema2.<#>)"
    );

    vastbaseVectorStore.distanceStrategy = "euclidean";
    vastbaseVectorStore.extensionSchemaName = "schema3";
    expect(vastbaseVectorStore.computedOperatorString).toEqual(
      "OPERATOR(schema3.<->)"
    );
  });
});

describe("VastbaseVectorStore with collection", () => {
  let vastbaseVectorStore: VastbaseVectorStore;
  const tableName = "testlangchain_collection";
  const collectionTableName = "langchain_vb_collection";

  beforeAll(async () => {
    const config = {
      vastbaseConnectionOptions,
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

    vastbaseVectorStore = await VastbaseVectorStore.initialize(
      embeddingsEngine,
      { ...config, dimensions: 1024 } // Specify dimensions for the vector column
    );
  });

  afterEach(async () => {
    // Drop table, then recreate it for the next test.
    await vastbaseVectorStore.pool.query(`DROP TABLE "${tableName}"`);
    await vastbaseVectorStore.pool.query(
      `DROP TABLE ${vastbaseVectorStore.computedCollectionTableName}`
    );
    await vastbaseVectorStore.ensureTableInDatabase(1024);
    await vastbaseVectorStore.ensureCollectionTableInDatabase();
  });

  afterAll(async () => {
    await vastbaseVectorStore.end();
  });

  test("'name' column is indexed", async () => {
    const result = await vastbaseVectorStore.pool.query(
      `SELECT * FROM pg_indexes WHERE tablename = '${vastbaseVectorStore.computedCollectionTableName}'`
    );
    const expectedIndexName = `idx_${vastbaseVectorStore.computedCollectionTableName}_name`;

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
    await vastbaseVectorStore.addDocuments(documents);
    const results = await vastbaseVectorStore.similaritySearch("hello", 2, {
      a: 2,
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toEqual("Cat drinks milk");
  });

  test("Vastbase can save documents with a list greater than default chunk size", async () => {
    // Extract the default chunk size and add one.
    const docsToGenerate = vastbaseVectorStore.chunkSize + 1;
    const documents = [];
    for (let i = 1; i <= docsToGenerate; i += 1) {
      documents.push({ pageContent: "Lorem Ipsum", metadata: { a: i } });
    }
    await vastbaseVectorStore.addDocuments(documents);

    // Query the table to check the number of rows
    const result = await vastbaseVectorStore.pool.query(
      `SELECT COUNT(*) FROM "${tableName}"`
    );
    const rowCount = parseInt(result.rows[0].count, 10);
    // Check if the number of rows is equal to the number of documents added
    expect(rowCount).toEqual(docsToGenerate);
  });

  test("Vastbase can save documents with ids", async () => {
    const id1 = "d8e70e98-19ab-4438-9c14-4bb2bb21a1f9";
    const id2 = "2bbb4b73-efec-4d5e-80ea-df94a4ed3aa3";

    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
    ];

    await vastbaseVectorStore.addDocuments(documents, { ids: [id1, id2] });

    const result = await vastbaseVectorStore.pool.query(
      `SELECT id FROM "${tableName}" WHERE id = $1`,
      [id1]
    );

    expect(result.rowCount).toEqual(1);
  });

  test("Vastbase supports different filter types", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 100 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 200 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 300 } },
    ];

    await vastbaseVectorStore.addDocuments(documents);

    const result = await vastbaseVectorStore.similaritySearch("hello", 2, {
      a: {
        in: [100, 300],
      },
    });

    expect(result.length).toEqual(2);
    expect(result).toEqual([
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: 100 },
      },
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: 300 },
      },
    ]);

    const result2 = await vastbaseVectorStore.similaritySearch("hello", 2, {
      a: 200,
    });
    expect(result2.length).toEqual(1);
    expect(result2).toEqual([
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: 200 },
      },
    ]);

    const result3 = await vastbaseVectorStore.similaritySearch("hello", 3);

    expect(result3.length).toEqual(3);
  });

  test("Vastbase can delete document by id", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 3 } },
    ];
    await vastbaseVectorStore.addDocuments(documents);

    const result = await vastbaseVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    const initialIds = result.rows.map((row) => row.id);
    const firstIdToDelete = initialIds[0];
    const secondIdToDelete = initialIds[1];
    const idToKeep = initialIds[2];

    await vastbaseVectorStore.delete({
      ids: [firstIdToDelete, secondIdToDelete],
    });

    const result2 = await vastbaseVectorStore.pool.query(
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

  test("Vastbase can delete document by metadata", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 1, c: 1 } },
    ];
    await vastbaseVectorStore.addDocuments(documents);
    const result = await vastbaseVectorStore.pool.query(
      `SELECT id FROM "${tableName}"`
    );

    const initialIds = result.rows.map((row) => row.id);

    // Filter Matches 1st document
    await vastbaseVectorStore.delete({ filter: { a: 1, b: 1 } });

    const result2 = await vastbaseVectorStore.pool.query(
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

describe("VastbaseVectorStore with schema", () => {
  let vastbaseVectorStore: VastbaseVectorStore;
  const tableName = "testlangchain_schema";
  const schema = "test_schema";
  const collectionTableName = "langchain_vb_collection_schema";
  let computedTableName: string;
  let computedCollectionTableName: string;
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool(vastbaseConnectionOptions);

    const config: VastbaseVectorStoreArgs = {
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

    vastbaseVectorStore = await VastbaseVectorStore.initialize(
      embeddingsEngine,
      { ...config, dimensions: 1024 } // Specify dimensions for the vector column
    );
    computedTableName = vastbaseVectorStore.computedTableName;
    computedCollectionTableName =
      vastbaseVectorStore.computedCollectionTableName;
  });

  afterEach(async () => {
    // Drop table, then recreate it for the next test.
    await vastbaseVectorStore.pool.query(`DROP TABLE ${computedTableName}`);
    await vastbaseVectorStore.pool.query(
      `DROP TABLE ${computedCollectionTableName}`
    );
    await vastbaseVectorStore.ensureTableInDatabase(1024);
    await vastbaseVectorStore.ensureCollectionTableInDatabase();
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await vastbaseVectorStore.end();
  });

  test("Test table creation with schema", async () => {
    const result = await vastbaseVectorStore.pool.query(
      `SELECT table_schema FROM information_schema.tables WHERE table_name = '${tableName}' AND table_schema = '${schema}'`
    );

    expect(result.rowCount).toEqual(1);

    const result2 = await vastbaseVectorStore.pool.query(
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
    await vastbaseVectorStore.addDocuments(documents);
    const results = await vastbaseVectorStore.similaritySearch("hello", 2, {
      a: 2,
    });

    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toEqual("Cat drinks milk");
  });

  test("Vastbase can save documents with a list greater than default chunk size", async () => {
    // Extract the default chunk size and add one.
    const docsToGenerate = vastbaseVectorStore.chunkSize + 1;
    const documents = [];
    for (let i = 1; i <= docsToGenerate; i += 1) {
      documents.push({ pageContent: "Lorem Ipsum", metadata: { a: i } });
    }
    await vastbaseVectorStore.addDocuments(documents);

    // Query the table to check the number of rows
    const result = await vastbaseVectorStore.pool.query(
      `SELECT COUNT(*) FROM ${computedTableName}`
    );
    const rowCount = parseInt(result.rows[0].count, 10);
    // Check if the number of rows is equal to the number of documents added
    expect(rowCount).toEqual(docsToGenerate);
  });

  test("Vastbase can save documents with ids", async () => {
    const id1 = "d8e70e98-19ab-4438-9c14-4bb2bb21a1f9";
    const id2 = "2bbb4b73-efec-4d5e-80ea-df94a4ed3aa3";

    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
    ];

    await vastbaseVectorStore.addDocuments(documents, { ids: [id1, id2] });

    const result = await vastbaseVectorStore.pool.query(
      `SELECT id FROM ${computedTableName} WHERE id = $1`,
      [id1]
    );

    expect(result.rowCount).toEqual(1);
  });

  test("Vastbase supports different filter types", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 100 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 200 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 300 } },
    ];

    await vastbaseVectorStore.addDocuments(documents);

    const result = await vastbaseVectorStore.similaritySearch("hello", 2, {
      a: {
        in: [100, 300],
      },
    });

    expect(result.length).toEqual(2);
    expect(result).toEqual([
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: 100 },
      },
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: 300 },
      },
    ]);

    const result2 = await vastbaseVectorStore.similaritySearch("hello", 2, {
      a: 200,
    });
    expect(result2.length).toEqual(1);
    expect(result2).toEqual([
      {
        id: expect.any(String),
        pageContent: "Lorem Ipsum",
        metadata: { a: 200 },
      },
    ]);

    const result3 = await vastbaseVectorStore.similaritySearch("hello", 3);

    expect(result3.length).toEqual(3);
  });

  test("Vastbase can delete document by id", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 3 } },
    ];
    await vastbaseVectorStore.addDocuments(documents);

    const result = await vastbaseVectorStore.pool.query(
      `SELECT id FROM ${computedTableName}`
    );

    const initialIds = result.rows.map((row) => row.id);
    const firstIdToDelete = initialIds[0];
    const secondIdToDelete = initialIds[1];
    const idToKeep = initialIds[2];

    await vastbaseVectorStore.delete({
      ids: [firstIdToDelete, secondIdToDelete],
    });

    const result2 = await vastbaseVectorStore.pool.query(
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

  test("Vastbase can delete document by metadata", async () => {
    const documents = [
      { pageContent: "Lorem Ipsum", metadata: { a: 1, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 2, b: 1 } },
      { pageContent: "Lorem Ipsum", metadata: { a: 1, c: 1 } },
    ];
    await vastbaseVectorStore.addDocuments(documents);
    const result = await vastbaseVectorStore.pool.query(
      `SELECT id FROM ${computedTableName}`
    );

    const initialIds = result.rows.map((row) => row.id);

    // Filter Matches 1st document
    await vastbaseVectorStore.delete({ filter: { a: 1, b: 1 } });

    const result2 = await vastbaseVectorStore.pool.query(
      `SELECT id FROM ${computedTableName}`
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

describe("VastbaseVectorStore with skipInitializationCheck", () => {
  let vastbaseVectorStore: VastbaseVectorStore;
  const tableName = "testlangchain_skip_init";

  afterEach(async () => {
    const pool = new pg.Pool(vastbaseConnectionOptions);
    await pool.query(`DROP TABLE IF EXISTS "${tableName}"`);
    await pool.end();
  });

  test("skipInitializationCheck=false (default) should initialize tables", async () => {
    const config: VastbaseVectorStoreArgs = {
      vastbaseConnectionOptions,
      tableName,
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    };

    vastbaseVectorStore = await VastbaseVectorStore.initialize(
      embeddingsEngine,
      { ...config, dimensions: 1024 } // Specify dimensions for the vector column
    );

    const result = await vastbaseVectorStore.pool.query(
      `SELECT EXISTS (
        SELECT * FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      )`
    );

    expect(result.rows[0].exists).toBe(true);
    await vastbaseVectorStore.end();
  });

  test("skipInitializationCheck=true should skip table initialization", async () => {
    const config: VastbaseVectorStoreArgs = {
      vastbaseConnectionOptions,
      tableName,
      skipInitializationCheck: true,
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    };

    vastbaseVectorStore = await VastbaseVectorStore.initialize(
      embeddingsEngine,
      { ...config, dimensions: 1024 } // Specify dimensions for the vector column
    );

    const tableExists = await vastbaseVectorStore.pool.query(
      `SELECT EXISTS (
        SELECT * FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
      )`
    );

    expect(tableExists.rows[0].exists).toBe(false);

    await vastbaseVectorStore.end();
  });

  test("skipInitializationCheck=true should work with addDocuments", async () => {
    const setupPool = new pg.Pool(vastbaseConnectionOptions);

    // await setupPool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await setupPool.query(`
      CREATE TABLE "${tableName}" (
        "id" uuid NOT NULL DEFAULT uuid() PRIMARY KEY,
        "content" text,
        "metadata" jsonb,
        "vector" floatvector(1024)
      );
    `);

    await setupPool.end();

    const config: VastbaseVectorStoreArgs = {
      vastbaseConnectionOptions,
      tableName,
      skipInitializationCheck: true,
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
    };

    vastbaseVectorStore = await VastbaseVectorStore.initialize(
      embeddingsEngine,
      { ...config, dimensions: 1024 } // Specify dimensions for the vector column
    );

    const documents = [
      { pageContent: "Hello world", metadata: { source: "test" } },
      {
        pageContent: "Testing skipInitializationCheck",
        metadata: { source: "test" },
      },
    ];

    await vastbaseVectorStore.addDocuments(documents);

    const query = await embeddingsEngine.embedQuery("Hello");
    const results = await vastbaseVectorStore.similaritySearchVectorWithScore(
      query,
      1
    );

    expect(results).toHaveLength(1);
    expect(results[0][0].pageContent).toBe("Hello world");

    await vastbaseVectorStore.end();
  });
});

describe("VastbaseVectorStore with HNSW index", () => {
  let vastbaseVectorStore: VastbaseVectorStore;
  const tableName = "testlangchain";

  beforeAll(async () => {
    const config: VastbaseVectorStoreArgs = {
      vastbaseConnectionOptions,
      tableName: "testlangchain",
      columns: {
        idColumnName: "id",
        vectorColumnName: "vector",
        contentColumnName: "content",
        metadataColumnName: "metadata",
      },
      distanceStrategy: "cosine",
    };

    vastbaseVectorStore = await VastbaseVectorStore.initialize(
      embeddingsEngine,
      { ...config, dimensions: 1024 } // Specify dimensions for the vector column
    );

    // Create the index
    await vastbaseVectorStore.createHnswIndex({ dimensions: 1024 });
  });

  afterEach(async () => {
    // Drop table, then recreate it for the next test.
    await vastbaseVectorStore.pool.query(`DROP TABLE "${tableName}"`);
    await vastbaseVectorStore.ensureTableInDatabase(1024);
    await vastbaseVectorStore.createHnswIndex({ dimensions: 1024 });
  });

  afterAll(async () => {
    await vastbaseVectorStore.end();
  });

  test("Ensure table has HNSW index", async () => {
    const result = await vastbaseVectorStore.pool.query(
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
    await vastbaseVectorStore.addDocuments(documents);

    const query = await embeddingsEngine.embedQuery("milk");
    const results = await vastbaseVectorStore.similaritySearchVectorWithScore(
      query,
      1
    );

    expect(results).toHaveLength(1);
    expect(results[0][0].pageContent).toEqual("Cat drinks milk");
  });
});
