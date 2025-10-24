/* eslint-disable no-process-env */
import { describe, expect, test } from "@jest/globals";
import { DataAPIClient, Db } from "@datastax/astra-db-ts";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { FakeEmbeddings } from "closevector-common/dist/fake.js";
import { AstraDBVectorStore, AstraLibArgs } from "../astradb.js";

describe.skip("AstraDBVectorStore", () => {
  let db: Db;
  let astraConfig: AstraLibArgs;
  beforeAll(() => {
    const clientConfig = {
      token: process.env.ASTRA_DB_APPLICATION_TOKEN ?? "dummy",
      endpoint: process.env.ASTRA_DB_ENDPOINT ?? "dummy",
      keyspace: process.env.ASTRA_DB_KEYSPACE ?? "default_keyspace",
    };

    const dataAPIClient = new DataAPIClient(clientConfig.token);
    db = dataAPIClient.db(clientConfig.endpoint);

    astraConfig = {
      ...clientConfig,
      collection: process.env.ASTRA_DB_COLLECTION ?? "langchain_test",
      collectionOptions: {
        vector: {
          dimension: 1536,
          metric: "cosine",
        },
      },
    };
  });

  beforeEach(async () => {
    try {
      await db.dropCollection(astraConfig.collection);
    } catch (e) {
      // console.debug("Collection doesn't exist yet, skipping drop");
    }
  });

  test("addDocuments", async () => {
    const store = new AstraDBVectorStore(new OpenAIEmbeddings(), astraConfig);
    await store.initialize();

    const pageContent: string[] = [
      faker.lorem.sentence(5),
      faker.lorem.sentence(5),
    ];
    const metadata = [{ foo: "bar" }, { foo: "baz" }];

    await store.addDocuments(
      pageContent.map(
        (content, idx) =>
          new Document({ pageContent: content, metadata: metadata[idx] })
      )
    );

    const results = await store.similaritySearch(pageContent[0], 1);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual(pageContent[0]);
    expect(results[0].metadata.foo).toEqual(metadata[0].foo);
  });

  test("fromText", async () => {
    const store = await AstraDBVectorStore.fromTexts(
      [
        "AstraDB is built on Apache Cassandra",
        "AstraDB is a NoSQL DB",
        "AstraDB supports vector search",
      ],
      [{ id: 123 }, { id: 456 }, { id: 789 }],
      new OpenAIEmbeddings(),
      astraConfig
    );

    const results = await store.similaritySearch("Apache Cassandra", 1);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual(
      "AstraDB is built on Apache Cassandra"
    );
    expect(results[0].metadata.id).toEqual(123);
  });

  test("fromExistingIndex", async () => {
    await AstraDBVectorStore.fromTexts(
      [
        "AstraDB is built on Apache Cassandra",
        "AstraDB is a NoSQL DB",
        "AstraDB supports vector search",
      ],
      [{ id: 123 }, { id: 456 }, { id: 789 }],
      new OpenAIEmbeddings(),
      astraConfig
    );

    const store2 = await AstraDBVectorStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      astraConfig
    );

    const results = await store2.similaritySearch("Apache Cassandra", 1);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual(
      "AstraDB is built on Apache Cassandra"
    );
    expect(results[0].metadata.id).toEqual(123);
  });

  test("delete", async () => {
    const store = await AstraDBVectorStore.fromTexts(
      [
        "AstraDB is built on Apache Cassandra",
        "AstraDB is a NoSQL DB",
        "AstraDB supports vector search",
      ],
      [{ id: 123 }, { id: 456 }, { id: 789 }],
      new OpenAIEmbeddings(),
      astraConfig
    );

    const results = await store.similaritySearch("Apache Cassandra", 1);

    expect(results.length).toEqual(1);
    expect(results[0].pageContent).toEqual(
      "AstraDB is built on Apache Cassandra"
    );
    expect(results[0].metadata.id).toEqual(123);

    await store.delete({ ids: [results[0].metadata._id] });

    const results2 = await store.similaritySearch("Apache Cassandra", 1);

    expect(results2[0].pageContent).not.toBe(
      "AstraDB is built on Apache Cassandra"
    );
  });

  test("collection exists", async () => {
    let store = new AstraDBVectorStore(new FakeEmbeddings(), astraConfig);
    await store.initialize();
    await store.initialize();
    try {
      store = new AstraDBVectorStore(new FakeEmbeddings(), {
        ...astraConfig,
        collectionOptions: {
          vector: {
            dimension: 8,
            metric: "cosine",
          },
        },
      });
      await store.initialize();
      fail("Should have thrown error");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      expect(e.message).toContain(
        "already exists with different collection options"
      );
    }
  }, 60000);

  test("skipCollectionProvisioning", async () => {
    let store = new AstraDBVectorStore(new FakeEmbeddings(), {
      ...astraConfig,
      skipCollectionProvisioning: true,
      collectionOptions: undefined,
    });
    await store.initialize();
    try {
      await store.similaritySearch("test");
      fail("Should have thrown error");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      expect(e.message).toContain("langchain_test");
    }
    store = new AstraDBVectorStore(new FakeEmbeddings(), {
      ...astraConfig,
      skipCollectionProvisioning: false,
      collectionOptions: {
        checkExists: false,
        vector: {
          dimension: 4,
          metric: "cosine",
        },
      },
    });
    await store.initialize();
    await store.similaritySearch("test");
  });

  test("upsert", async () => {
    const store = new AstraDBVectorStore(new FakeEmbeddings(), {
      ...astraConfig,
      collectionOptions: {
        vector: {
          dimension: 4,
          metric: "cosine",
        },
      },
    });
    await store.initialize();

    await store.addDocuments([
      { pageContent: "Foo bar baz.", metadata: { a: 1, _id: "123456789" } },
      { pageContent: "Bar baz foo.", metadata: { a: 2, _id: "987654321" } },
      { pageContent: "Baz foo bar.", metadata: { a: 3, _id: "234567891" } },
    ]);

    await store.addDocuments([
      { pageContent: "upserted", metadata: { a: 1, _id: "123456789" } },
    ]);

    const collection = await db.collection(astraConfig.collection);
    const doc = await collection.findOne({ _id: "123456789" });

    expect(doc?.text).toEqual("upserted");
  });
});
