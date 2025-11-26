/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  describe,
  test,
  beforeEach,
  afterAll,
  expect,
  beforeAll,
} from "@jest/globals";
import { Cluster } from "couchbase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { faker } from "@faker-js/faker";

import {
  CouchbaseQueryVectorStore,
  CouchbaseQueryVectorStoreArgs,
  DistanceStrategy,
  IndexType,
} from "../couchbase_query.js";

describe.skip("CouchbaseQueryVectorStore", () => {
  // Configuration
  const config = {
    // **Note** user must have permissions to create buckets and indexes, and must be able to flush buckets
    // unfortunately, Couchbase Capella doesn't support this level of access for database users,
    // so these tests must run against a local Couchbase server
    cluster: process.env.COUCHBASE_CLUSTER || "couchbase://localhost",
    username: process.env.COUCHBASE_USERNAME || "Administrator",
    password: process.env.COUCHBASE_PASSWORD || "password",
    bucketName: "test-bucket",
    indexTestBucketName: "test-index-bucket",
    scopeName: "_default",
    collectionName: "_default",
    textKey: "text",
    embeddingKey: "embedding",
    distanceStrategy: DistanceStrategy.COSINE,
  };

  let cluster: Cluster;
  let store: CouchbaseQueryVectorStore;
  let indexTestStore: CouchbaseQueryVectorStore;
  let embeddings: OpenAIEmbeddings;

  beforeAll(async () => {
    // Create embeddings instance
    embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Connect to Couchbase
    cluster = await Cluster.connect(config.cluster, {
      username: config.username,
      password: config.password,
    });

    // Create bucket if it doesn't exist
    try {
      const buckets = await cluster.buckets().getAllBuckets();
      if (!buckets.some((bucket) => bucket.name === config.bucketName)) {
        await cluster.buckets().createBucket({
          name: config.bucketName,
          ramQuotaMB: 2000,
          flushEnabled: true,
        });
      }
      // create a separate bucket for index testing
      if (
        !buckets.some((bucket) => bucket.name === config.indexTestBucketName)
      ) {
        await cluster.buckets().createBucket({
          name: config.indexTestBucketName,
          ramQuotaMB: 2000,
          flushEnabled: true,
        });
      }
    } catch (err: any) {
      if (err.code !== 605) {
        // 605 is bucket_exists error
        console.error("Error creating bucket:", err);
        throw err;
      }
    }
  });

  beforeEach(async () => {
    try {
      await cluster.buckets().flushBucket(config.bucketName);
    } catch (error: any) {
      console.warn("Could not flush bucket during cleanup:", error.message);
    }
    // Initialize store
    try {
      const storeConfig: CouchbaseQueryVectorStoreArgs = {
        cluster,
        bucketName: config.bucketName,
        scopeName: config.scopeName,
        collectionName: config.collectionName,
        textKey: config.textKey,
        embeddingKey: config.embeddingKey,
      };

      store = await CouchbaseQueryVectorStore.initialize(
        embeddings,
        storeConfig
      );

      const indexTestStoreConfig: CouchbaseQueryVectorStoreArgs = {
        cluster,
        bucketName: config.indexTestBucketName,
        scopeName: config.scopeName,
        collectionName: config.collectionName,
        textKey: config.textKey,
        embeddingKey: config.embeddingKey,
      };

      indexTestStore = await CouchbaseQueryVectorStore.initialize(
        embeddings,
        indexTestStoreConfig
      );
    } catch (error) {
      console.error("Failed to initialize test suite:", error);
      throw error;
    }
  });

  afterAll(async () => {
    if (cluster) {
      try {
        await cluster.buckets().flushBucket(config.bucketName);
      } catch (error: any) {
        console.warn(
          "Could not flush bucket during aterAll cleanup:",
          error.message
        );
      }
      await cluster.close();
    }
  });

  // Helper function to create test data
  const createTestData = (count: number) => {
    const texts = Array.from({ length: count }, () => faker.lorem.paragraph());
    const metadatas = Array.from({ length: count }, () => ({
      source: faker.system.fileName(),
      author: faker.person.fullName(),
    }));
    return { texts, metadatas };
  };

  // Helper function to create bulk test data for index training
  const createBulkTestData = (count: number) => {
    const documents = [];
    for (let i = 0; i < count; i += 1) {
      documents.push(
        new Document({
          pageContent: `Document ${i}: ${faker.hacker.phrase()}! ${faker.company.catchPhrase()}`,
          metadata: {
            source: "bulk_test",
            index: i,
            category: faker.helpers.arrayElement([
              "tech",
              "business",
              "science",
              "art",
            ]),
            rating: faker.number.int({ min: 1, max: 5 }),
          },
        })
      );
    }
    return documents;
  };

  // Helper function to add documents in batches for better performance
  const addDocumentsInBatches = async (
    documents: Document[],
    batchSize = 50
  ) => {
    const allIds = [];
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const ids = await indexTestStore.addDocuments(batch);
      allIds.push(...ids);
    }
    return allIds;
  };

  describe("Initialization", () => {
    test("should initialize with default values", async () => {
      expect(store).toBeDefined();
      expect(store.embeddings).toBeDefined();
    });
  });

  describe("Document Operations", () => {
    test("should add documents with metadata", async () => {
      const { texts, metadatas } = createTestData(2);
      const documents = texts.map(
        (text, i) => new Document({ pageContent: text, metadata: metadatas[i] })
      );

      const ids = await store.addDocuments(documents);
      expect(ids).toHaveLength(2);

      const results = await store.similaritySearch(texts[0], 1);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe(texts[0]);
      expect(results[0].metadata).toEqual(metadatas[0]);
    });

    test("should add documents with custom IDs", async () => {
      const { texts } = createTestData(2);
      const documents = texts.map(
        (text) => new Document({ pageContent: text })
      );
      const customIds = ["doc1", "doc2"];

      const ids = await store.addDocuments(documents, { ids: customIds });
      expect(ids).toEqual(customIds);

      const results = await store.similaritySearch(texts[0], 1);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe(texts[0]);
    });

    test("should delete documents", async () => {
      const { texts } = createTestData(2);
      const documents = texts.map(
        (text) => new Document({ pageContent: text })
      );

      const ids = await store.addDocuments(documents);
      expect(ids).toHaveLength(2);

      await store.delete({ ids });
      const results = await store.similaritySearch(texts[0], 1);
      expect(results).toHaveLength(0);
    });
  });

  describe("Search Operations", () => {
    test("should perform similarity search", async () => {
      const { texts } = createTestData(2);
      const documents = texts.map(
        (text) => new Document({ pageContent: text })
      );

      await store.addDocuments(documents);

      const results = await store.similaritySearch(texts[0], 1);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe(texts[0]);
    });

    test("should perform similarity search with score", async () => {
      const { texts } = createTestData(2);
      const documents = texts.map(
        (text) => new Document({ pageContent: text })
      );

      await store.addDocuments(documents);

      const results = await store.similaritySearchWithScore(texts[0], 1);
      expect(results).toHaveLength(1);
      expect(results[0][0].pageContent).toBe(texts[0]);
      expect(typeof results[0][1]).toBe("number");
    });

    test("should perform similarity search by vector", async () => {
      const { texts } = createTestData(2);
      const documents = texts.map(
        (text) => new Document({ pageContent: text })
      );

      await store.addDocuments(documents);

      const queryEmbedding = await embeddings.embedQuery(texts[0]);
      const results = await store.similaritySearchByVector(queryEmbedding, 1);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe(texts[0]);
    });

    test("should perform similarity search with filters", async () => {
      const { texts, metadatas } = createTestData(2);
      const documents = texts.map(
        (text, i) => new Document({ pageContent: text, metadata: metadatas[i] })
      );

      await store.addDocuments(documents);

      const results = await store.similaritySearch(texts[0], 1, {
        fields: ["text", "metadata.author"],
      });
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe(texts[0]);
      expect(results[0].metadata.author).toBe(metadatas[0].author);
    });
  });

  describe("Factory Methods", () => {
    test("should create store from texts", async () => {
      const { texts, metadatas } = createTestData(2);

      const newStore = await CouchbaseQueryVectorStore.fromTexts(
        texts,
        metadatas,
        embeddings,
        {
          cluster,
          bucketName: config.bucketName,
          scopeName: config.scopeName,
          collectionName: config.collectionName,
          textKey: config.textKey,
          embeddingKey: config.embeddingKey,
        }
      );

      const results = await newStore.similaritySearch(texts[0], 1);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe(texts[0]);
      expect(results[0].metadata).toEqual(metadatas[0]);
    });

    test("should create store from documents", async () => {
      const { texts, metadatas } = createTestData(2);
      const documents = texts.map(
        (text, i) => new Document({ pageContent: text, metadata: metadatas[i] })
      );

      const newStore = await CouchbaseQueryVectorStore.fromDocuments(
        documents,
        embeddings,
        {
          cluster,
          bucketName: config.bucketName,
          scopeName: config.scopeName,
          collectionName: config.collectionName,
          textKey: config.textKey,
          embeddingKey: config.embeddingKey,
        }
      );

      const results = await newStore.similaritySearch(texts[0], 1);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe(texts[0]);
      expect(results[0].metadata).toEqual(metadatas[0]);
    });
  });

  describe("Index Creation", () => {
    const MINIMUM_DOCS_FOR_TRAINING = 1200; // Slightly above the 1024 minimum
    let bulkDocumentIds: string[] = [];

    beforeAll(async () => {
      // Create bulk test data
      const bulkDocuments = createBulkTestData(MINIMUM_DOCS_FOR_TRAINING);

      // Add documents in batches for better performance
      bulkDocumentIds = await addDocumentsInBatches(bulkDocuments, 100);
    });

    afterAll(async () => {
      // Clean up bulk documents
      if (bulkDocumentIds.length > 0) {
        try {
          await indexTestStore.delete({ ids: bulkDocumentIds });
        } catch (error) {
          console.warn("Error cleaning up bulk documents:", error);
        }
      }

      // Clean up indexes
      await dropAllIndexesWithManager(cluster, config.indexTestBucketName);
    });

    async function dropAllIndexesWithManager(
      cluster: Cluster,
      bucketName: string
    ) {
      const queryIndexManager = cluster.queryIndexes();

      try {
        // Get all indexes
        const indexes = await queryIndexManager.getAllIndexes(bucketName);

        // Drop all secondary indexes
        for (const index of indexes) {
          if (!index.isPrimary) {
            await queryIndexManager.dropIndex(bucketName, index.name);
          }
        }
      } catch (error) {
        console.error("Error:", error);
      }
    }

    test("should create HYPERSCALE vector index", async () => {
      const createHyperscaleIndexOptions = {
        indexType: IndexType.HYPERSCALE,
        indexDescription: "IVF1024,SQ8",
        distanceMetric: DistanceStrategy.COSINE,
        indexName: "my_hyperscale_vector_index",
        vectorDimension: 1536,
        fields: ["text", "metadata"],
        whereClause: "metadata.source = 'bulk_test'",
        indexScanNprobes: 10,
        indexTrainlist: 1024,
      };

      // Test that createIndex doesn't throw an error
      await expect(
        indexTestStore.createIndex(createHyperscaleIndexOptions)
      ).resolves.not.toThrow();

      const indexes = await cluster
        .queryIndexes()
        .getAllIndexes(config.indexTestBucketName);
      expect(
        indexes.some(
          (index) => index.name === createHyperscaleIndexOptions.indexName
        )
      ).toBe(true);
    });

    test("should create COMPOSITE vector index", async () => {
      const createCompositeIndexOptions = {
        indexType: IndexType.COMPOSITE,
        indexDescription: "IVF1024,SQ8",
        distanceMetric: DistanceStrategy.COSINE,
        indexName: "my_composite_vector_index",
        vectorDimension: 1536,
        fields: ["text", "metadata.category"],
        whereClause: "metadata.source = 'bulk_test'",
        indexScanNprobes: 3,
        indexTrainlist: 1024,
      };

      // Test that createIndex doesn't throw an error
      await expect(
        indexTestStore.createIndex(createCompositeIndexOptions)
      ).resolves.not.toThrow();

      const indexes = await cluster
        .queryIndexes()
        .getAllIndexes(config.indexTestBucketName);
      expect(
        indexes.some(
          (index) => index.name === createCompositeIndexOptions.indexName
        )
      ).toBe(true);
    });

    test("should create index with minimal options", async () => {
      const minimalOptions = {
        indexType: IndexType.HYPERSCALE,
        indexDescription: "IVF,SQ8",
        indexName: "minimal_options_index",
        whereClause: "metadata.source = 'bulk_test'",
      };

      // Test that createIndex works with minimal options
      await expect(
        indexTestStore.createIndex(minimalOptions)
      ).resolves.not.toThrow();

      const indexes = await cluster
        .queryIndexes()
        .getAllIndexes(config.indexTestBucketName);
      expect(
        indexes.some((index) => index.name === minimalOptions.indexName)
      ).toBe(true);
    });

    test("should auto-detect vector dimension from embeddings", async () => {
      const optionsWithoutDimension = {
        indexType: IndexType.HYPERSCALE,
        indexDescription: "IVF,SQ8",
        indexName: "auto_dimension_index",
        whereClause: "metadata.source = 'bulk_test'",
      };

      // Test that createIndex works without specifying dimension
      await expect(
        indexTestStore.createIndex(optionsWithoutDimension)
      ).resolves.not.toThrow();

      const indexes = await cluster
        .queryIndexes()
        .getAllIndexes(config.indexTestBucketName);
      expect(
        indexes.some(
          (index) => index.name === optionsWithoutDimension.indexName
        )
      ).toBe(true);
    });

    test("should handle index creation errors gracefully", async () => {
      const invalidOptions = {
        indexType: IndexType.HYPERSCALE,
        indexDescription: "", // Empty description should cause an error
        indexName: "invalid_index",
      };

      // Test that createIndex handles errors gracefully
      await expect(
        indexTestStore.createIndex(invalidOptions)
      ).rejects.toThrow();

      const indexes = await cluster
        .queryIndexes()
        .getAllIndexes(config.indexTestBucketName);
      expect(
        indexes.some((index) => index.name === invalidOptions.indexName)
      ).toBe(false);
    });

    test("should create both HYPERSCALE and COMPOSITE indexes sequentially", async () => {
      const createHyperscaleIndexOptions = {
        indexType: IndexType.HYPERSCALE,
        indexDescription: "IVF1024,SQ8",
        distanceMetric: DistanceStrategy.COSINE,
        indexName: "sequential_hyperscale_index",
        whereClause: "metadata.source = 'bulk_test'",
      };

      const createCompositeIndexOptions = {
        indexType: IndexType.COMPOSITE,
        indexDescription: "IVF1024,SQ8",
        distanceMetric: DistanceStrategy.COSINE,
        indexName: "sequential_composite_index",
        whereClause: "metadata.source = 'bulk_test'",
      };

      // Test creating both index types sequentially
      await expect(
        indexTestStore.createIndex(createHyperscaleIndexOptions)
      ).resolves.not.toThrow();
      await expect(
        indexTestStore.createIndex(createCompositeIndexOptions)
      ).resolves.not.toThrow();

      const indexes = await cluster
        .queryIndexes()
        .getAllIndexes(config.indexTestBucketName);
      expect(
        indexes.some(
          (index) => index.name === createHyperscaleIndexOptions.indexName
        )
      ).toBe(true);
      expect(
        indexes.some(
          (index) => index.name === createCompositeIndexOptions.indexName
        )
      ).toBe(true);
    });

    test("should use default distance strategy when not specified", async () => {
      const optionsWithoutDistance = {
        indexType: IndexType.HYPERSCALE,
        indexDescription: "IVF,SQ8",
        indexName: "default_distance_index",
        whereClause: "metadata.source = 'bulk_test'",
      };

      // Test that createIndex uses default distance strategy
      await expect(
        indexTestStore.createIndex(optionsWithoutDistance)
      ).resolves.not.toThrow();

      const indexes = await cluster
        .queryIndexes()
        .getAllIndexes(config.indexTestBucketName);
      expect(
        indexes.some((index) => index.name === optionsWithoutDistance.indexName)
      ).toBe(true);
    });

    test("should handle different distance strategies", async () => {
      const distanceStrategies = [
        DistanceStrategy.DOT,
        DistanceStrategy.EUCLIDEAN,
        DistanceStrategy.COSINE,
        DistanceStrategy.EUCLIDEAN_SQUARED,
      ];

      for (let i = 0; i < distanceStrategies.length; i += 1) {
        const options = {
          indexType: IndexType.HYPERSCALE,
          indexDescription: "IVF,SQ8",
          distanceMetric: distanceStrategies[i],
          indexName: `distance_test_index_${i}`,
          whereClause: "metadata.source = 'bulk_test'",
        };

        await expect(
          indexTestStore.createIndex(options)
        ).resolves.not.toThrow();
        const indexes = await cluster
          .queryIndexes()
          .getAllIndexes(config.indexTestBucketName);
        expect(indexes.some((index) => index.name === options.indexName)).toBe(
          true
        );
      }
    }, 60000);
  });
});
