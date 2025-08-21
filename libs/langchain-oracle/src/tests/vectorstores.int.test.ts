/* eslint-disable no-process-env */
import { createHash } from "crypto";
import { env } from "node:process";
import { expect, test } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import oracledb from "oracledb";
import {
  createIndex,
  DistanceStrategy,
  dropTablePurge,
  OracleEmbeddings,
  type OracleDBVSArgs,
} from "../index.js";
import { OracleVS, type Metadata } from "../vectorstores.js";

describe("OracleVectorStore", () => {
  const tableName = "testlangchain_1";
  let pool: oracledb.Pool;
  let embedder: OracleEmbeddings;
  let connection: oracledb.Connection | undefined;
  let oraclevs: OracleVS | undefined;
  let dbConfig: OracleDBVSArgs;

  beforeAll(async () => {
    pool = await oracledb.createPool({
      user: env.ORACLE_USERNAME,
      password: env.ORACLE_PASSWORD,
      connectString: env.ORACLE_DSN,
    });

    const pref = {
      provider: "database",
      model: env.DEMO_ONNX_MODEL,
    };
    connection = await pool.getConnection();
    embedder = new OracleEmbeddings(connection, pref);
    dbConfig = {
      client: pool,
      tableName,
      distanceStrategy: DistanceStrategy.DOT_PRODUCT,
      query: "What are salient features of oracledb",
    };
  });

  beforeEach(async () => {
    // Drop table for the next test.
    await dropTablePurge(connection as oracledb.Connection, tableName);
  });

  afterAll(async () => {
    await dropTablePurge(connection as oracledb.Connection, tableName);
    await connection?.close();
    await pool.close();
  });

  test("Test vectorstore fromDocuments", async () => {
    let connection: oracledb.Connection | undefined;

    try {
      connection = await pool.getConnection();
      const docs = [];
      docs.push(new Document({ pageContent: "I like soccer." }));
      docs.push(new Document({ pageContent: "I love Stephen King." }));

      oraclevs = await OracleVS.fromDocuments(docs, embedder, dbConfig);

      await createIndex(connection, oraclevs, {
        idxName: "embeddings_idx",
        idxType: "IVF",
        neighborPart: 64,
        accuracy: 90,
      });

      const embedding = await embedder.embedQuery(
        "What is your favourite sport?"
      );
      const matches = await oraclevs.similaritySearchVectorWithScore(
        embedding,
        1
      );

      expect(matches).toHaveLength(1);
    } finally {
      if (connection) {
        await connection?.close();
      }
    }
  });

  test("Test vectorstore addDocuments", async () => {
    oraclevs = new OracleVS(embedder, dbConfig);
    await oraclevs.initialize();

    const docs = [
      new Document({ pageContent: "hello", metadata: { a: 2 } }),
      new Document({ pageContent: "car", metadata: { a: 1 } }),
      new Document({ pageContent: "adjective", metadata: { a: 1 } }),
      new Document({ pageContent: "hi", metadata: { a: 1 } }),
    ];
    await oraclevs.addDocuments(docs);
    const results1 = await oraclevs.similaritySearch("hello!", 1);
    expect(results1).toHaveLength(1);
    expect(results1).toEqual([
      expect.objectContaining({ metadata: { a: 2 }, pageContent: "hello" }),
    ]);

    const dbFilter = { a: 1 };
    const results2 = await oraclevs.similaritySearchWithScore(
      "hello!",
      1,
      dbFilter
    );
    expect(results2).toHaveLength(1);
  });

  test("Test vectorstore addDocuments and find using filter IN and NIN Clause", async () => {
    oraclevs = new OracleVS(embedder, dbConfig);
    await oraclevs.initialize();

    const makeDoc = (
      content: string,
      author: string | string[],
      category = "research/AI"
    ) => ({
      pageContent: content,
      metadata: {
        category,
        author: Array.isArray(author) ? author : [author],
        tags: ["AI", "ML"],
        status: "release",
      },
    });

    const docs = [
      makeDoc(
        "Alice discusses the application of machine learning and AI research in predicting football match outcomes.",
        ["Alice", "Bob"],
        "sports"
      ),
      makeDoc(
        "Geoffrey Hinton explores the future of deep learning and its impact on AI research.",
        "Geoffrey Hinton"
      ),
      makeDoc(
        "Yoshua Bengio presents breakthroughs in neural network architectures for natural language understanding.",
        "Yoshua Bengio"
      ),
      makeDoc(
        "Andrew Ng shares insights on scaling AI education to democratize access to machine learning tools.",
        "Andrew Ng"
      ),
    ];

    await oraclevs.addDocuments(docs);

    // $in clause
    let filter: Metadata = { author: { $in: ["Andrew Ng", "Demis Hassabis"] } };
    let results = await oraclevs.similaritySearch(
      "latest advances in AI research for education",
      1,
      filter
    );

    expect(results).toHaveLength(1);
    expect(results).toEqual([
      expect.objectContaining({
        metadata: {
          category: "research/AI",
          author: ["Andrew Ng"],
          tags: ["AI", "ML"],
          status: "release",
        },
        pageContent:
          "Andrew Ng shares insights on scaling AI education to democratize access to machine learning tools.",
      }),
    ]);

    // without $in clause
    filter = { author: ["Andrew Ng", "Demis Hassabis"] };
    results = await oraclevs.similaritySearch(
      "latest advances in AI research for education",
      1,
      filter
    );

    expect(results).toHaveLength(1);
    expect(results).toEqual([
      expect.objectContaining({
        metadata: {
          category: "research/AI",
          author: ["Andrew Ng"],
          tags: ["AI", "ML"],
          status: "release",
        },
        pageContent:
          "Andrew Ng shares insights on scaling AI education to democratize access to machine learning tools.",
      }),
    ]);

    // with $nin clause
    filter = { author: { $nin: ["Andrew Ng", "Demis Hassabis"] } };
    results = await oraclevs.similaritySearch(
      "latest advances in AI research for education",
      5,
      filter
    );

    expect(results).toHaveLength(3);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metadata: {
            category: "research/AI",
            author: ["Geoffrey Hinton"],
            tags: ["AI", "ML"],
            status: "release",
          },
          pageContent:
            "Geoffrey Hinton explores the future of deep learning and its impact on AI research.",
        }),
        expect.objectContaining({
          metadata: {
            category: "research/AI",
            author: ["Yoshua Bengio"],
            tags: ["AI", "ML"],
            status: "release",
          },
          pageContent:
            "Yoshua Bengio presents breakthroughs in neural network architectures for natural language understanding.",
        }),

        expect.objectContaining({
          metadata: {
            category: "sports",
            author: ["Alice", "Bob"],
            tags: ["AI", "ML"],
            status: "release",
          },
          pageContent:
            "Alice discusses the application of machine learning and AI research in predicting football match outcomes.",
        }),
      ])
    );
  });

  test("should handle simple conditions with and without _and clause", async () => {
    oraclevs = new OracleVS(embedder, dbConfig);
    await oraclevs.initialize();

    // Sample documents
    const docs = [
      new Document({
        pageContent: "A thrilling fantasy novel with dragons and magic.",
        metadata: { category: "books", price: 15 },
      }),
      new Document({
        pageContent: "A guide to healthy cooking with fresh vegetables.",
        metadata: { category: "books", price: 25 },
      }),
      new Document({
        pageContent: "A strategy board game with medieval warfare theme.",
        metadata: { category: "games", price: 40 },
      }),
      new Document({
        pageContent: "A suspense narrative in Paris.",
        metadata: { category: "books", price: 10 },
      }),
    ];

    await oraclevs.addDocuments(docs);

    // FilterCondition to have keywords , key, oper, value..
    let filter: Metadata = {
      $and: [{ category: "books" }, { price: { $lte: 20 } }],
    };
    let results = await oraclevs.similaritySearch("test", 5, filter);
    expect(results).toBeInstanceOf(Array);
    expect(results).toHaveLength(2);
    results.forEach((doc) => {
      expect(doc.metadata.category).toBe("books");
      expect(doc.metadata.price).toBeLessThanOrEqual(20);
    });

    // FilterCondition to have a simple filter
    filter = {
      $and: [{ category: "books" }],
    };
    results = await oraclevs.similaritySearch("test", 4, filter);
    expect(results).toBeInstanceOf(Array);
    expect(results).toHaveLength(3); // gives all rows with category books

    results.forEach((doc) => {
      expect(doc.metadata.category).toBe("books");
    });

    // filter with out _and keyword
    filter = { category: "books" };
    results = await oraclevs.similaritySearch("test", 4, filter);
    expect(results).toBeInstanceOf(Array);
    expect(results).toHaveLength(3); // gives all rows with category books
    results.forEach((doc) => {
      expect(doc.metadata.category).toBe("books");
    });

    // filter with simple key/value and comparision with out _and keyword
    filter = { category: "books", price: 10 };
    results = await oraclevs.similaritySearch("test", 4, filter);
    expect(results).toBeInstanceOf(Array);
    expect(results).toHaveLength(1); // gives all rows with category books and price 10
    results.forEach((doc) => {
      expect(doc.metadata.category).toBe("books");
      expect(doc.metadata.price).toBe(10);
    });

    // filter with simple key/value
    filter = { price: 10 };
    results = await oraclevs.similaritySearch("test", 4, filter);
    expect(results).toBeInstanceOf(Array);
    expect(results).toHaveLength(1); // gives all rows with price 10
    results.forEach((doc) => {
      expect(doc.metadata.category).toBe("books");
      expect(doc.metadata.price).toBe(10);
    });

    // filter with $between
    filter = { price: { $between: [10, 25] } };
    results = await oraclevs.similaritySearch("test", 4, filter);
    expect(results).toBeInstanceOf(Array);
    expect(results).toHaveLength(3); // gives all rows with price between [10, 25]
    results.forEach((doc) => {
      expect(doc.metadata.category).toBe("books");
      expect(doc.metadata.price).toBeGreaterThanOrEqual(10);
      expect(doc.metadata.price).toBeLessThanOrEqual(25);
    });

    // filter with $exists
    filter = { price: { $exists: true } };
    results = await oraclevs.similaritySearch("test", 10, filter);
    expect(results).toBeInstanceOf(Array);
    expect(results).toHaveLength(4); // gives all rows with price key

    // filter with $exists to return rows which do not contain price
    filter = { price: { $exists: false } };
    await expect(oraclevs.similaritySearch("test", 10, filter)).rejects.toThrow(
      "No rows found"
    );

    // filter with $exists for non-existing key
    filter = { cost: { $exists: true } };
    await expect(oraclevs.similaritySearch("test", 10, filter)).rejects.toThrow(
      "No rows found"
    );
  });

  test("should handle a simple _or clause", async () => {
    oraclevs = new OracleVS(embedder, dbConfig);
    await oraclevs.initialize();

    // Sample documents
    const docs = [
      new Document({
        pageContent: "A thrilling fantasy novel with dragons and magic.",
        metadata: { category: "books", price: 15 },
      }),
      new Document({
        pageContent: "A guide to healthy cooking with fresh vegetables.",
        metadata: { category: "books", price: 25 },
      }),
      new Document({
        pageContent: "A strategy board game with medieval warfare theme.",
        metadata: { category: "games", price: 15 },
      }),
      new Document({
        pageContent: "A suspense narrative in Paris.",
        metadata: { category: "books", price: 10 },
      }),
      new Document({
        pageContent:
          "A strategy board game with medieval Civil Constructions theme.",
        metadata: { category: "games", price: 40 },
      }),
    ];
    await oraclevs.addDocuments(docs);
    const filter: Metadata = {
      $or: [{ category: "books" }, { price: { $lte: 20 } }],
    };
    const results = await oraclevs.similaritySearch("test", 6, filter);
    expect(results).toBeInstanceOf(Array);
    expect(results).toHaveLength(4);

    results.forEach((doc) => {
      expect(
        doc.metadata.price <= 20 || doc.metadata.category === "books"
      ).toBe(true);
    });
  });

  test("should handle a nested _and and _or clause", async () => {
    oraclevs = new OracleVS(embedder, dbConfig);
    await oraclevs.initialize();

    // Sample docs
    const docs = [
      new Document({
        id: "1",
        pageContent: "A thrilling mystery novel",
        metadata: { category: "books", price: 15, rating: 4.5 },
      }),
      new Document({
        id: "2",
        pageContent: "An expensive historical book",
        metadata: { category: "books", price: 35, rating: 4.7 },
      }),

      new Document({
        id: "3",
        pageContent: "Affordable cooking guide",
        metadata: { category: "books", price: 18, rating: 4.2 },
      }),

      new Document({
        id: "4",
        pageContent: "Wireless Bluetooth headphones",
        metadata: { category: "electronics", price: 50, rating: 4.1 },
      }),

      new Document({
        id: "5",
        pageContent: "Budget wired earphones",
        metadata: { category: "electronics", price: 15, rating: 3.9 },
      }),
    ];

    // Insert into the vector store with ids provided.
    await oraclevs.addDocuments(docs, { ids: ["1", "2", "3", "4", "5"] });

    const filter: Metadata = {
      $or: [
        // First OR branch: simple AND group
        {
          $and: [{ category: "books" }, { price: { $lte: 20 } }],
        },
        // Second OR branch: nested OR inside AND
        {
          $and: [
            { category: "electronics" },
            {
              $or: [{ price: { $lte: 20 } }, { rating: { $gte: 4.5 } }],
            },
          ],
        },
      ],
    };

    // Complex filter example with _or and nested _and/_or
    const results = await oraclevs.similaritySearch("test", 10, filter);
    const expectedId = (id: string) => {
      const buf = Buffer.from(
        createHash("sha256")
          .update(id)
          .digest("hex")
          .substring(0, 16)
          .toUpperCase(),
        "hex"
      );
      return buf.toString("hex");
    };
    expect(results).toHaveLength(3);
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pageContent: "A thrilling mystery novel",
          metadata: { category: "books", price: 15, rating: 4.5 },
          id: expectedId("1"),
        }),
        expect.objectContaining({
          pageContent: "Budget wired earphones",
          metadata: { category: "electronics", price: 15, rating: 3.9 },
          id: expectedId("5"),
        }),
        expect.objectContaining({
          pageContent: "Affordable cooking guide",
          metadata: { category: "books", price: 18, rating: 4.2 },
          id: expectedId("3"),
        }),
      ])
    );
  });

  test("Test MMR search", async () => {
    oraclevs = new OracleVS(embedder, dbConfig);
    await oraclevs.initialize();

    const documents = [
      {
        pageContent: "Top 10 beaches in Spain with golden sands",
        metadata: { country: "Spain" },
      },
      {
        pageContent: "Hidden gems: remote Greek islands you must visit",
        metadata: { country: "Greece" },
      },
      {
        pageContent: "Spain's Costa Brava: a detailed travel guide",
        metadata: { country: "Spain" },
      },
      {
        pageContent: "Best beaches in Croatia with crystal-clear waters",
        metadata: { country: "Croatia" },
      },
      {
        pageContent: "Budget travel tips for backpacking across Europe",
        metadata: { country: "General" },
      },
    ];

    await oraclevs.addDocuments(documents);
    const results = await oraclevs.maxMarginalRelevanceSearch(
      "best beaches in Europe",
      {
        k: 3,
      }
    );

    // Extract only page contents for checking
    const pageContents = results.map((r) => r.pageContent);

    // Should have 3 results
    expect(pageContents).toHaveLength(3);

    // Results should be relevant but not all from the same country
    const countries = new Set(results.map((r) => r.metadata.country));
    expect(countries.size).toBeGreaterThan(1); // ensures diversity

    // The top result should be highly relevant to "best beaches"
    expect(pageContents[0].toLowerCase()).toMatch(/beach|island/);
  });

  test("Delete document by id", async () => {
    let connection: oracledb.Connection | undefined;

    const documents = [
      { pageContent: "Hello", metadata: { a: 1 } },
      { pageContent: "Bye", metadata: { a: 2 } },
      { pageContent: "FIFO", metadata: { a: 3 } },
    ];

    try {
      connection = await pool.getConnection();
      const oraclevs = new OracleVS(embedder, dbConfig);
      await oraclevs.initialize();
      await oraclevs.addDocuments(documents);

      const getIds = async (): Promise<Buffer[]> => {
        const res = await connection!.execute(`SELECT id FROM "${tableName}"`);
        return (res.rows ?? []).map((row: unknown) => {
          if (
            !Array.isArray(row) ||
            row.length === 0 ||
            !Buffer.isBuffer(row[0])
          ) {
            throw new Error(`Unexpected row format: ${JSON.stringify(row)}`);
          }
          return row[0];
        });
      };

      const [id1, id2, idKeep] = await getIds();
      await oraclevs.delete({ ids: [id1, id2] });

      const idsAfterDelete = await getIds();
      expect(idsAfterDelete).toHaveLength(1);
      expect(idsAfterDelete).toContainEqual(idKeep);
      expect(idsAfterDelete).not.toContainEqual(id1);
      expect(idsAfterDelete).not.toContainEqual(id2);
    } finally {
      await connection?.close();
    }
  });
});
