/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test } from "@jest/globals";
import { Cluster } from "couchbase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import {
  CouchbaseVectorStore,
  CouchbaseVectorStoreArgs,
} from "../couchbase.js";

describe.skip("Couchbase vector store", () => {
  const connectionString =
    process.env.COUCHBASE_DB_CONN_STR ?? "couchbase://localhost";
  const databaseUsername = process.env.COUCHBASE_DB_USERNAME ?? "Administrator";
  const databasePassword = process.env.COUCHBASE_DB_PASSWORD ?? "Password";
  const bucketName = process.env.COUCHBASE_DB_BUCKET_NAME ?? "testing";
  const scopeName = process.env.COUCHBASE_DB_SCOPE_NAME ?? "_default";
  const collectionName = process.env.COUCHBASE_DB_COLLECTION_NAME ?? "_default";
  const indexName = process.env.COUCHBASE_DB_INDEX_NAME ?? "vector-index";
  const textFieldKey = "text";
  const embeddingFieldKey = "embedding";
  const isScopedIndex = true;
  let couchbaseClient: Cluster;
  let embeddings: OpenAIEmbeddings;

  const texts = [
    "Couchbase, built on a key-value store, offers efficient data operations.",
    "As a NoSQL database, Couchbase provides scalability and flexibility to handle diverse data types.",
    "Couchbase supports N1QL, a SQL-like language, easing the transition for developers familiar with SQL.",
    "Couchbase ensures high availability with built-in fault tolerance and automatic multi-master replication.",
    "With its memory-first architecture, Couchbase delivers high performance and low latency data access.",
  ];

  const metadata = [
    { id: "101", name: "Efficient Operator" },
    { id: "102", name: "Flexible Storer" },
    { id: "103", name: "Quick Performer" },
    { id: "104", name: "Reliable Guardian" },
    { id: "105", name: "Adaptable Navigator" },
  ];

  beforeEach(async () => {
    couchbaseClient = await Cluster.connect(connectionString, {
      username: databaseUsername,
      password: databasePassword,
      configProfile: "wanDevelopment",
    });

    embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  });

  test("from Texts to vector store", async () => {
    const couchbaseConfig: CouchbaseVectorStoreArgs = {
      cluster: couchbaseClient,
      bucketName,
      scopeName,
      collectionName,
      indexName,
      textKey: textFieldKey,
      embeddingKey: embeddingFieldKey,
      scopedIndex: isScopedIndex,
    };

    const store = await CouchbaseVectorStore.fromTexts(
      texts,
      metadata,
      embeddings,
      couchbaseConfig
    );
    const results = await store.similaritySearchWithScore(texts[0], 1);

    expect(results.length).toEqual(1);
    expect(results[0][0].pageContent).toEqual(texts[0]);
    expect(results[0][0].metadata.name).toEqual(metadata[0].name);
    expect(results[0][0].metadata.id).toEqual(metadata[0].id);
  });

  test("Add and delete Documents to vector store", async () => {
    const couchbaseConfig: CouchbaseVectorStoreArgs = {
      cluster: couchbaseClient,
      bucketName,
      scopeName,
      collectionName,
      indexName,
      textKey: textFieldKey,
      embeddingKey: embeddingFieldKey,
      scopedIndex: isScopedIndex,
    };

    const documents: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      documents.push({
        pageContent: texts[i],
        metadata: {},
      });
    }

    const store = await CouchbaseVectorStore.initialize(
      embeddings,
      couchbaseConfig
    );
    const ids = await store.addDocuments(documents, {
      ids: metadata.map((val) => val.id),
      metadata: metadata.map((val) => {
        const metadataObj = {
          name: val.name,
        };
        return metadataObj;
      }),
    });

    expect(ids.length).toEqual(texts.length);
    for (let i = 0; i < ids.length; i += 1) {
      expect(ids[i]).toEqual(metadata[i].id);
    }

    const results = await store.similaritySearch(texts[1], 1);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual(texts[1]);
    expect(results[0].metadata.name).toEqual(metadata[1].name);

    await store.delete(ids);
    const cbCollection = couchbaseClient
      .bucket(bucketName)
      .scope(scopeName)
      .collection(collectionName);
    expect((await cbCollection.exists(ids[0])).exists).toBe(false);
    expect((await cbCollection.exists(ids[4])).exists).toBe(false);

    const resultsDeleted = await store.similaritySearch(texts[1], 1);
    expect(resultsDeleted.length).not.toEqual(1);
  });

  test("hybrid search", async () => {
    const couchbaseConfig: CouchbaseVectorStoreArgs = {
      cluster: couchbaseClient,
      bucketName,
      scopeName,
      collectionName,
      indexName,
      textKey: textFieldKey,
      embeddingKey: embeddingFieldKey,
      scopedIndex: isScopedIndex,
    };

    const query = `Couchbase offers impressive memory-first performance for your important applications.`;

    const hybridSearchMetadata: { [key: string]: any }[] = [];

    // Add More Metadata
    for (let i = 0; i < texts.length; i += 1) {
      const doc: { [key: string]: any } = {};
      doc.date = `${2020 + (i % 10)}-01-01`;
      doc.rating = 1 + (i % 5);
      doc.author = ["John Doe", "Jane Doe"][(i + 1) % 2];
      doc.id = (i + 100).toString();
      hybridSearchMetadata.push(doc);
    }
    const store = await CouchbaseVectorStore.fromTexts(
      texts,
      hybridSearchMetadata,
      embeddings,
      couchbaseConfig
    );

    const resultsSimilaritySearch = await store.similaritySearch(query, 1);
    expect(resultsSimilaritySearch.length).toEqual(1);
    expect(resultsSimilaritySearch[0].metadata.date).not.toEqual(undefined);

    // search by exact value in metadata
    const exactValueResult = await store.similaritySearch(query, 4, {
      fields: ["metadata.author"],
      searchOptions: {
        query: { field: "metadata.author", match: "John Doe" },
      },
    });

    expect(exactValueResult.length).toEqual(4);
    expect(exactValueResult[0].metadata.author).toEqual("John Doe");

    // search by partial match in metadata
    const partialMatchResult = await store.similaritySearch(query, 4, {
      fields: ["metadata.author"],
      searchOptions: {
        query: { field: "metadata.author", match: "Johny", fuzziness: 1 },
      },
    });

    expect(partialMatchResult.length).toEqual(4);
    expect(partialMatchResult[0].metadata.author).toEqual("John Doe");

    // search by date range
    const dateRangeResult = await store.similaritySearch(query, 4, {
      fields: ["metadata.date", "metadata.author"],
      searchOptions: {
        query: {
          start: "2022-12-31",
          end: "2023-01-02",
          inclusiveStart: true,
          inclusiveEnd: false,
          field: "metadata.date",
        },
      },
    });

    expect(dateRangeResult.length).toEqual(4);

    // search by rating range
    const ratingRangeResult = await store.similaritySearch(texts[0], 4, {
      fields: ["metadata.rating"],
      searchOptions: {
        query: {
          min: 3,
          max: 5,
          inclusiveMin: false,
          inclusiveMax: true,
          field: "metadata.rating",
        },
      },
    });
    expect(ratingRangeResult.length).toEqual(4);

    // multiple search conditions
    const multipleConditionsResult = await store.similaritySearch(texts[0], 4, {
      fields: ["metadata.rating", "metadata.date"],
      searchOptions: {
        query: {
          conjuncts: [
            { min: 3, max: 4, inclusive_max: true, field: "metadata.rating" },
            { start: "2022-12-31", end: "2023-01-02", field: "metadata.date" },
          ],
        },
      },
    });
    expect(multipleConditionsResult.length).toEqual(4);
  });
});
