import {
  MariaDbContainer,
  StartedMariaDbContainer,
} from "@testcontainers/mariadb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { type Pool, PoolConfig } from "mariadb";
import { MariaDBStore, MariaDBStoreArgs } from "../mariadb.js";

const isFullyQualifiedTableExists = async (
  pool: Pool,
  schema: string,
  tableName: string
): Promise<boolean> => {
  const sql =
    "SELECT EXISTS (SELECT * FROM information_schema.tables WHERE table_schema = ? AND table_name = ?) as results";
  const res = await pool.query(sql, [schema, tableName]);
  return res[0][0] as boolean;
};
const removeQuotes = (field: string): string => {
  if (field.charAt(0) === "`") return field.substring(1, field.length - 1);
  return field;
};
const areColumnsExisting = async (
  pool: Pool,
  schema: string,
  tableName: string,
  fieldNames: string[]
): Promise<boolean> => {
  const sql =
    "SELECT EXISTS (SELECT * FROM information_schema.columns WHERE table_schema= ? AND  table_name = ? AND column_name = ?)";

  for (let i = 0; i < fieldNames.length; i += 1) {
    const res = await pool.query(sql, [
      schema,
      removeQuotes(tableName),
      removeQuotes(fieldNames[i]),
    ]);
    if (res[0][0]) continue;
    return false;
  }
  return true;
};

describe("MariaDBVectorStore", () => {
  let container: StartedMariaDbContainer;

  beforeAll(async () => {
    container = await new MariaDbContainer("mariadb:11.7-rc").start();
  });

  afterAll(async () => {
    await container.stop();
  });

  describe("automatic table creation", () => {
    it.each([
      ["myTable", "myId", "myVector", "myContent", "myMetadata", undefined],
      [
        "myTable 2",
        "myId 2",
        "myVector 2",
        "myContent 2",
        "myMetadata 2",
        undefined,
      ],
      [
        "myTable",
        "myId",
        "myVector",
        "myContent",
        "myMetadata",
        "myCollectionTableName",
      ],
      [
        "myTable` 2",
        "myId` 2",
        "myVector` 2",
        "myContent` 2",
        "myMetadata` 2",
        "myCollectionTableName` 2",
      ],
    ])(
      "automatic table %p %p %p %p %p",
      async (
        tableName: string,
        idColumnName: string,
        vectorColumnName: string,
        contentColumnName: string,
        metadataColumnName: string,
        collectionTableName?: string
      ) => {
        const localStore = await MariaDBStore.initialize(
          new OpenAIEmbeddings(),
          {
            connectionOptions: {
              host: container.getHost(),
              port: container.getFirstMappedPort(),
              user: container.getUsername(),
              password: container.getUserPassword(),
              database: container.getDatabase(),
            } as PoolConfig,
            tableName,
            columns: {
              idColumnName,
              vectorColumnName,
              contentColumnName,
              metadataColumnName,
            },
            collectionTableName,
            distanceStrategy: "EUCLIDEAN",
          } as MariaDBStoreArgs
        );
        expect(
          isFullyQualifiedTableExists(
            localStore.pool,
            container.getDatabase(),
            "myTable"
          )
        ).toBeTruthy();
        expect(
          areColumnsExisting(
            localStore.pool,
            container.getDatabase(),
            "myTable",
            ["myId", "myVector", "myContent", "myMetadata"]
          )
        ).toBeTruthy();
        await localStore.similaritySearch("hello", 10);
        await localStore.delete({
          ids: ["63ae8c92-799a-11ef-98b2-f859713e4be4"],
        });
        const documents = [
          { pageContent: "hello", metadata: { a: 2023, country: "US" } },
        ];
        await localStore.addDocuments(documents);
        await localStore.pool.query("DROP TABLE " + localStore.tableName);
      }
    );
  });

  describe("without collection", () => {
    let store: MariaDBStore;

    beforeAll(async () => {
      store = await MariaDBStore.initialize(new OpenAIEmbeddings(), {
        connectionOptions: {
          type: "mariadb",
          host: container.getHost(),
          port: container.getFirstMappedPort(),
          user: container.getUsername(),
          password: container.getUserPassword(),
          database: container.getDatabase(),
        } as PoolConfig,
      } as MariaDBStoreArgs);
    });

    const documents = [
      { pageContent: "hello", metadata: { a: 2023, country: "US" } },
      { pageContent: "Cat drinks milk", metadata: { a: 2025, country: "EN" } },
      { pageContent: "hi", metadata: { a: 2025, country: "FR" } },
    ];
    const ids = [
      "cd41294a-afb0-11df-bc9b-00241dd75637",
      "a2443495-1b94-415b-b6fa-fe8e79ba4812",
      "63ae8c92-799a-11ef-98b2-f859713e4be4",
    ];
    beforeEach(async () => {
      await store.pool.query("TRUNCATE TABLE " + store.tableName);
      await store.addDocuments(documents, { ids });
    });
    test("similarity limit", async () => {
      let results = await store.similaritySearch("hello", 10);
      expect(results.length).toEqual(3);
      expect(results[0].pageContent).toEqual("hello");
      expect(results[0].metadata.a).toEqual(2023);

      results = await store.similaritySearch("hello", 1);
      expect(results.length).toEqual(1);
      expect(results[0].pageContent).toEqual("hello");
      expect(results[0].metadata.a).toEqual(2023);
    });

    test("similarity with filter", async () => {
      let results = await store.similaritySearch("hi", 10, { a: 2025 });
      expect(results.length).toEqual(2);
      expect(results[0].pageContent).toEqual("hi");
      expect(results[0].metadata.a).toEqual(2025);

      results = await store.similaritySearch("hi", 10, {
        a: { $gte: 2025 },
        country: { $in: ["GE", "FR"] },
      });
      expect(results.length).toEqual(1);
      expect(results[0].pageContent).toEqual("hi");
      expect(results[0].metadata.a).toEqual(2025);
    });

    test("deletion with filter", async () => {
      try {
        await store.delete({});
        throw new Error("expected to fails");
      } catch (e) {
        expect((e as Error).message).toEqual(
          "You must specify either ids or a filter when deleting documents."
        );
      }

      await store.delete({ filter: { a: { $eq: 2023 } } });
      let res = await store.pool.query(
        "SELECT COUNT(*) as a FROM " + store.tableName
      );
      expect(res[0][0]).toEqual(2n);

      await store.delete({ ids: ["63ae8c92-799a-11ef-98b2-f859713e4be4"] });
      res = await store.pool.query("SELECT COUNT(*) FROM " + store.tableName);
      expect(res[0][0]).toEqual(1n);
    });
  });

  describe("with collection", () => {
    let store: MariaDBStore;

    beforeAll(async () => {
      store = await MariaDBStore.initialize(new OpenAIEmbeddings(), {
        connectionOptions: {
          type: "mariadb",
          host: container.getHost(),
          port: container.getFirstMappedPort(),
          user: container.getUsername(),
          password: container.getUserPassword(),
          database: container.getDatabase(),
        } as PoolConfig,
        collectionTableName: "myCollectionTable",
      } as MariaDBStoreArgs);
    });

    const documents = [
      { pageContent: "hello", metadata: { a: 2023, country: "US" } },
      { pageContent: "Cat drinks milk", metadata: { a: 2025, country: "EN" } },
      { pageContent: "hi", metadata: { a: 2025, country: "FR" } },
    ];
    const ids = [
      "cd41294a-afb0-11df-bc9b-00241dd75637",
      "a2443495-1b94-415b-b6fa-fe8e79ba4812",
      "63ae8c92-799a-11ef-98b2-f859713e4be4",
    ];

    beforeEach(async () => {
      await store.pool.query("TRUNCATE TABLE " + store.tableName);
      await store.addDocuments(documents, { ids });
    });

    test("similarity limit", async () => {
      let results = await store.similaritySearch("hello", 10);
      expect(results.length).toEqual(3);
      expect(results[0].pageContent).toEqual("hello");
      expect(results[0].metadata.a).toEqual(2023);

      results = await store.similaritySearch("hello", 1);
      expect(results.length).toEqual(1);
      expect(results[0].pageContent).toEqual("hello");
      expect(results[0].metadata.a).toEqual(2023);
    });

    test("similarity with filter", async () => {
      let results = await store.similaritySearch("hi", 10, { a: 2025 });
      expect(results.length).toEqual(2);
      expect(results[0].pageContent).toEqual("hi");
      expect(results[0].metadata.a).toEqual(2025);

      results = await store.similaritySearch("hi", 10, {
        a: { $gte: 2025 },
        country: { $in: ["GE", "FR"] },
      });
      expect(results.length).toEqual(1);
      expect(results[0].pageContent).toEqual("hi");
      expect(results[0].metadata.a).toEqual(2025);
    });

    test("deletion with filter", async () => {
      try {
        await store.delete({});
        throw new Error("expected to fails");
      } catch (e) {
        expect((e as Error).message).toEqual(
          "You must specify either ids or a filter when deleting documents."
        );
      }

      await store.delete({ filter: { a: 2023 } });
      let res = await store.pool.query(
        "SELECT COUNT(*) as a FROM " + store.tableName
      );
      expect(res[0][0]).toEqual(2n);

      await store.delete({ ids: ["63ae8c92-799a-11ef-98b2-f859713e4be4"] });
      res = await store.pool.query("SELECT COUNT(*) FROM " + store.tableName);
      expect(res[0][0]).toEqual(1n);
    });
  });
});
