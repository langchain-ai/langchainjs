/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  describe,
  test,
  beforeEach,
  afterAll,
  expect,
  beforeAll,
} from "@jest/globals";
import { Cluster, ISearchIndex } from "couchbase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { faker } from "@faker-js/faker";
import {
  CouchbaseSearchVectorStore,
  CouchbaseSearchVectorStoreArgs,
} from "../couchbase_search.js";

// Helper function to delay execution
const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

describe.skip("CouchbaseSearchVectorStore", () => {
  // Configuration
  const config = {
    cluster: process.env.COUCHBASE_CLUSTER || "couchbase://localhost",
    username: process.env.COUCHBASE_USERNAME || "Administrator",
    password: process.env.COUCHBASE_PASSWORD || "password",
    bucketName: "test-bucket",
    scopeName: "_default",
    collectionName: "_default",
    indexName: "test-index",
    textKey: "text",
    embeddingKey: "embedding",
  };

  let cluster: Cluster;
  let store: CouchbaseSearchVectorStore;
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
    } catch (err: any) {
      if (err.code !== 605) {
        // 605 is bucket_exists error
        throw err;
      }
    }

    await delay(5000);

    // Create search index if it doesn't exist
    try {
      const indexDefinition: ISearchIndex = {
        type: "fulltext-index",
        name: config.indexName,
        uuid: "",
        sourceType: "gocbcore",
        sourceName: config.bucketName,
        sourceUuid: "",
        planParams: {
          maxPartitionsPerPIndex: 1024,
          indexPartitions: 1,
        },
        params: {
          doc_config: {
            docid_prefix_delim: "",
            docid_regexp: "",
            mode: "scope.collection.type_field",
            type_field: "type",
          },
          mapping: {
            analysis: {},
            default_analyzer: "standard",
            default_datetime_parser: "dateTimeOptional",
            default_field: "_all",
            default_mapping: {
              dynamic: false,
              enabled: false,
            },
            default_type: "_default",
            docvalues_dynamic: false,
            index_dynamic: true,
            store_dynamic: true,
            type_field: "_type",
            types: {
              [`${config.scopeName}.${config.collectionName}`]: {
                dynamic: true,
                enabled: true,
                properties: {
                  text: {
                    dynamic: false,
                    enabled: true,
                    fields: [
                      {
                        analyzer: "en",
                        index: true,
                        docvalues: true,
                        include_term_vectors: true,
                        name: "text",
                        store: true,
                        type: "text",
                      },
                    ],
                  },
                  embedding: {
                    dynamic: false,
                    enabled: true,
                    fields: [
                      {
                        dims: 1536,
                        index: true,
                        name: "embedding",
                        similarity: "dot_product",
                        type: "vector",
                        vector_index_optimized_for: "recall",
                      },
                    ],
                  },
                },
              },
            },
          },
          store: {
            indexType: "scorch",
            segmentVersion: 16,
          },
        },
        sourceParams: {},
      };

      const indexes = await cluster.searchIndexes().getAllIndexes();

      if (!indexes.some((index) => index.name === config.indexName)) {
        await cluster.searchIndexes().upsertIndex(indexDefinition);
      }

      await delay(15000);
    } catch (err: any) {
      if (err.code !== 12016) {
        // 12016 is index_exists error
        throw err;
      }
    }
  });

  beforeEach(async () => {
    await cluster.buckets().flushBucket(config.bucketName);

    // Initialize store
    const storeConfig: CouchbaseSearchVectorStoreArgs = {
      cluster,
      bucketName: config.bucketName,
      scopeName: config.scopeName,
      collectionName: config.collectionName,
      indexName: config.indexName,
      scopedIndex: false,
      textKey: config.textKey,
      embeddingKey: config.embeddingKey,
    };

    store = await CouchbaseSearchVectorStore.initialize(
      embeddings,
      storeConfig
    );
  });

  afterAll(async () => {
    if (cluster) {
      await cluster.buckets().flushBucket(config.bucketName);
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

      // Wait for index to be ready
      await delay(2000);

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

      // Wait for index to be ready
      await delay(2000);

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

      // Wait for index to be ready
      await delay(2000);

      await store.delete(ids);
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

      // Wait for index to be ready
      await delay(2000);

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

      // Wait for index to be ready
      await delay(2000);

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

      // Wait for index to be ready
      await delay(2000);

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

      // Wait for index to be ready
      await delay(2000);

      const results = await store.similaritySearch(texts[0], 1, {
        fields: ["text", "metadata.author"],
        searchOptions: {
          filter: `metadata.author:"${metadatas[0].author}"`,
        },
      });
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe(texts[0]);
      expect(results[0].metadata.author).toBe(metadatas[0].author);
    });
  });

  describe("Factory Methods", () => {
    test("should create store from texts", async () => {
      const { texts, metadatas } = createTestData(2);

      const newStore = await CouchbaseSearchVectorStore.fromTexts(
        texts,
        metadatas,
        embeddings,
        {
          cluster,
          bucketName: config.bucketName,
          scopeName: config.scopeName,
          collectionName: config.collectionName,
          indexName: config.indexName,
          scopedIndex: false,
          textKey: config.textKey,
          embeddingKey: config.embeddingKey,
        }
      );

      // Wait for index to be ready
      await delay(2000);

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

      const newStore = await CouchbaseSearchVectorStore.fromDocuments(
        documents,
        embeddings,
        {
          cluster,
          bucketName: config.bucketName,
          scopeName: config.scopeName,
          collectionName: config.collectionName,
          indexName: config.indexName,
          scopedIndex: false,
          textKey: config.textKey,
          embeddingKey: config.embeddingKey,
        }
      );

      // Wait for index to be ready
      await delay(2000);

      const results = await newStore.similaritySearch(texts[0], 1);
      expect(results).toHaveLength(1);
      expect(results[0].pageContent).toBe(texts[0]);
      expect(results[0].metadata).toEqual(metadatas[0]);
    });
  });
});
