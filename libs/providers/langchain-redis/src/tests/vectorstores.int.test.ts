import { test, expect, describe } from "vitest";

import { RedisClientType, createClient } from "redis";
import { v4 as uuidv4 } from "uuid";
import { faker } from "@faker-js/faker";
import { Document } from "@langchain/core/documents";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";

import { RedisVectorStore } from "../vectorstores.js";
import { FluentRedisVectorStore } from "../vectorstores_fluent.js";
import { Geo, Tag, Num, Text, Timestamp } from "../filters.js";

describe("RedisVectorStore", () => {
  test("auto-generated ids", async () => {
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();

    const vectorStore = new RedisVectorStore(new SyntheticEmbeddings(), {
      redisClient: client as RedisClientType,
      indexName: "test-auto-ids",
      keyPrefix: "test-auto:",
    });

    try {
      const pageContent = faker.lorem.sentence(5);

      await vectorStore.addDocuments([
        { pageContent, metadata: { foo: "bar" } },
      ]);

      const results = await vectorStore.similaritySearch(pageContent, 1);

      expect(results).toEqual([
        new Document({ metadata: { foo: "bar" }, pageContent }),
      ]);
    } finally {
      await vectorStore.delete({ deleteAll: true });
      await client.quit();
    }
  });

  test("user-provided keys", async () => {
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();

    const vectorStore = new RedisVectorStore(new SyntheticEmbeddings(), {
      redisClient: client as RedisClientType,
      indexName: "test-user-keys",
      keyPrefix: "test-user:",
    });

    try {
      const documentKey = `test-user:${uuidv4()}`;
      const pageContent = faker.lorem.sentence(5);

      await vectorStore.addDocuments([{ pageContent, metadata: {} }], {
        keys: [documentKey],
      });

      const results = await vectorStore.similaritySearch(pageContent, 1);

      expect(results).toEqual([new Document({ metadata: {}, pageContent })]);
    } finally {
      await vectorStore.delete({ deleteAll: true });
      await client.quit();
    }
  });

  test("metadata filtering", async () => {
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();

    const vectorStore = new RedisVectorStore(new SyntheticEmbeddings(), {
      redisClient: client as RedisClientType,
      indexName: "test-metadata-filter",
      keyPrefix: "test-filter:",
      filter: ["sentence"],
    });

    try {
      const pageContent = faker.lorem.sentence(5);

      await vectorStore.addDocuments([
        { pageContent, metadata: { foo: "bar" } },
        { pageContent, metadata: { foo: "filter by this sentence" } },
        { pageContent, metadata: { foo: "qux" } },
      ]);

      // If the filter wasn't working, we'd get all 3 documents back
      const results = await vectorStore.similaritySearch(pageContent, 3);

      expect(results).toEqual([
        new Document({
          metadata: { foo: "filter by this sentence" },
          pageContent,
        }),
      ]);
    } finally {
      await vectorStore.delete({ deleteAll: true });
      await client.quit();
    }
  });

  test("delete documents by ids", async () => {
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();

    const vectorStore = new RedisVectorStore(new SyntheticEmbeddings(), {
      redisClient: client as RedisClientType,
      indexName: "test-delete-ids",
      keyPrefix: "test-delete:",
    });

    try {
      const documentIds = ["doc1", "doc2"];
      const documentKeys = documentIds.map((id) => `test-delete:${id}`);
      const pageContent = faker.lorem.sentence(5);

      const documents = documentKeys.map((key) => ({
        pageContent,
        metadata: {
          id: key,
        },
      }));

      await vectorStore.addDocuments(documents, {
        keys: documentKeys,
      });

      const results = await vectorStore.similaritySearch(pageContent, 2);
      expect(results).toHaveLength(2);
      expect(results.map((result) => result.metadata.id)).toEqual(documentKeys);

      await vectorStore.delete({ ids: [documentIds[0]] });

      const results2 = await vectorStore.similaritySearch(pageContent, 2);
      expect(results2).toHaveLength(1);
      expect(results2.map((result) => result.metadata.id)).toEqual(
        documentKeys.slice(1)
      );
    } finally {
      await vectorStore.delete({ deleteAll: true });
      await client.quit();
    }
  });
});

describe("FluentRedisVectorStore", () => {
  test("geo metadata filtering with vector search", async () => {
    const geoClient = createClient({ url: process.env.REDIS_URL });
    await geoClient.connect();

    const geoVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: geoClient as RedisClientType,
        indexName: "test-geo-index",
        keyPrefix: "test-geo:",
        customSchema: [
          { name: "location", type: "geo" },
          { name: "name", type: "text" },
          { name: "category", type: "tag" },
        ],
      }
    );

    try {
      const pageContent = "A great restaurant with amazing food";

      // Add documents with geo coordinates
      // San Francisco: -122.4194, 37.7749
      // New York: -74.0060, 40.7128
      // Los Angeles: -118.2437, 34.0522
      // Seattle: -122.3321, 47.6062
      await geoVectorStore.addDocuments([
        {
          pageContent,
          metadata: {
            name: "Restaurant in San Francisco",
            location: [-122.4194, 37.7749], // Array format
            category: "restaurant",
          },
        },
        {
          pageContent,
          metadata: {
            name: "Restaurant in New York",
            location: "-74.0060,40.7128", // String format
            category: "restaurant",
          },
        },
        {
          pageContent,
          metadata: {
            name: "Restaurant in Los Angeles",
            location: [-118.2437, 34.0522],
            category: "restaurant",
          },
        },
        {
          pageContent,
          metadata: {
            name: "Restaurant in Seattle",
            location: [-122.3321, 47.6062],
            category: "restaurant",
          },
        },
      ]);

      // First, verify all documents were indexed
      const allDocs = await geoVectorStore.similaritySearch(pageContent, 10);
      expect(allDocs.length).toBe(4);

      // Test 1: Find restaurants within 100km of San Francisco
      // Should find: San Francisco only
      const sfFilter = Geo("location").within(-122.4194, 37.7749, 100, "km");
      const sfResults = await geoVectorStore.similaritySearch(
        pageContent,
        10,
        sfFilter
      );

      expect(sfResults.length).toBe(1);
      expect(sfResults[0].metadata.name).toContain("San Francisco");
      expect(sfResults.some((r) => r.metadata.name.includes("New York"))).toBe(
        false
      );

      // Test 2: Find restaurants within 1000km of San Francisco
      // Note: Actual distances from SF:
      // - Los Angeles: ~559 km (within range)
      // - Seattle: ~1094 km (outside 1000km range)
      // - New York: ~4139 km (far outside range)
      const westCoastFilter = Geo("location").within(
        -122.4194,
        37.7749,
        1000,
        "km"
      );
      const westCoastResults = await geoVectorStore.similaritySearch(
        pageContent,
        10,
        westCoastFilter
      );

      expect(westCoastResults.length).toBe(2);
      expect(
        westCoastResults.some((r) => r.metadata.name.includes("San Francisco"))
      ).toBe(true);
      expect(
        westCoastResults.some((r) => r.metadata.name.includes("Los Angeles"))
      ).toBe(true);
      expect(
        westCoastResults.some((r) => r.metadata.name.includes("Seattle"))
      ).toBe(false);
      expect(
        westCoastResults.some((r) => r.metadata.name.includes("New York"))
      ).toBe(false);

      // Test 3: Find restaurants within 5000km of San Francisco
      // Should find: All restaurants
      const allFilter = Geo("location").within(-122.4194, 37.7749, 5000, "km");
      const allResults = await geoVectorStore.similaritySearch(
        pageContent,
        10,
        allFilter
      );

      expect(allResults.length).toBe(4);

      // Test 4: Find restaurants outside 100km of San Francisco
      // Should find: New York, Los Angeles (not San Francisco, possibly not Seattle)
      const outsideFilter = Geo("location").outside(
        -122.4194,
        37.7749,
        100,
        "km"
      );
      const outsideResults = await geoVectorStore.similaritySearch(
        pageContent,
        10,
        outsideFilter
      );

      expect(outsideResults.length).toBeGreaterThanOrEqual(2);
      expect(
        outsideResults.some((r) => r.metadata.name.includes("San Francisco"))
      ).toBe(false);
      expect(
        outsideResults.some((r) => r.metadata.name.includes("New York"))
      ).toBe(true);

      // Test 5: Verify geo coordinates are returned correctly
      const firstResult = allResults[0];
      expect(firstResult.metadata.location).toBeDefined();
      // Location should be returned as [lon, lat] array after deserialization
      expect(Array.isArray(firstResult.metadata.location)).toBe(true);
      expect(firstResult.metadata.location).toHaveLength(2);
    } finally {
      // Clean up
      await geoVectorStore.delete({ deleteAll: true });
      await geoClient.quit();
    }
  });

  test("tag filter - single value eq", async () => {
    const tagClient = createClient({ url: process.env.REDIS_URL });
    await tagClient.connect();

    const tagVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: tagClient as RedisClientType,
        indexName: "test-tag-index",
        keyPrefix: "test-tag:",
        customSchema: [
          { name: "category", type: "tag" },
          { name: "brand", type: "tag" },
        ],
      }
    );

    try {
      const pageContent = "Product description";

      await tagVectorStore.addDocuments([
        { pageContent, metadata: { category: "electronics", brand: "Apple" } },
        { pageContent, metadata: { category: "books", brand: "Penguin" } },
        {
          pageContent,
          metadata: { category: "electronics", brand: "Samsung" },
        },
        { pageContent, metadata: { category: "clothing", brand: "Nike" } },
      ]);

      // Test single value eq
      const filter = Tag("category").eq("electronics");
      const results = await tagVectorStore.similaritySearch(
        pageContent,
        10,
        filter
      );

      expect(results.length).toBe(2);
      expect(results.every((r) => r.metadata.category === "electronics")).toBe(
        true
      );
    } finally {
      await tagVectorStore.delete({ deleteAll: true });
      await tagClient.quit();
    }
  });

  test("tag filter - multiple values eq (OR logic)", async () => {
    const tagClient = createClient({ url: process.env.REDIS_URL });
    await tagClient.connect();

    const tagVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: tagClient as RedisClientType,
        indexName: "test-tag-multi-index",
        keyPrefix: "test-tag-multi:",
        customSchema: [{ name: "category", type: "tag" }],
      }
    );

    try {
      const pageContent = "Product description";

      await tagVectorStore.addDocuments([
        { pageContent, metadata: { category: "electronics" } },
        { pageContent, metadata: { category: "books" } },
        { pageContent, metadata: { category: "clothing" } },
        { pageContent, metadata: { category: "sports" } },
      ]);

      // Test multiple values (OR logic)
      const filter = Tag("category").eq(["electronics", "books"]);
      const results = await tagVectorStore.similaritySearch(
        pageContent,
        10,
        filter
      );

      expect(results.length).toBe(2);
      expect(
        results.every(
          (r) =>
            r.metadata.category === "electronics" ||
            r.metadata.category === "books"
        )
      ).toBe(true);
    } finally {
      await tagVectorStore.delete({ deleteAll: true });
      await tagClient.quit();
    }
  });

  test("tag filter - ne (negation)", async () => {
    const tagClient = createClient({ url: process.env.REDIS_URL });
    await tagClient.connect();

    const tagVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: tagClient as RedisClientType,
        indexName: "test-tag-ne-index",
        keyPrefix: "test-tag-ne:",
        customSchema: [{ name: "category", type: "tag" }],
      }
    );

    try {
      const pageContent = "Product description";

      await tagVectorStore.addDocuments([
        { pageContent, metadata: { category: "electronics" } },
        { pageContent, metadata: { category: "books" } },
        { pageContent, metadata: { category: "clothing" } },
      ]);

      // Test negation
      const filter = Tag("category").ne("electronics");
      const results = await tagVectorStore.similaritySearch(
        pageContent,
        10,
        filter
      );

      expect(results.length).toBe(2);
      expect(results.every((r) => r.metadata.category !== "electronics")).toBe(
        true
      );
    } finally {
      await tagVectorStore.delete({ deleteAll: true });
      await tagClient.quit();
    }
  });

  test("tag filter - Set values", async () => {
    const tagClient = createClient({ url: process.env.REDIS_URL });
    await tagClient.connect();

    const tagVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: tagClient as RedisClientType,
        indexName: "test-tag-set-index",
        keyPrefix: "test-tag-set:",
        customSchema: [{ name: "category", type: "tag" }],
      }
    );

    try {
      const pageContent = "Product description";

      await tagVectorStore.addDocuments([
        { pageContent, metadata: { category: "electronics" } },
        { pageContent, metadata: { category: "books" } },
        { pageContent, metadata: { category: "clothing" } },
        { pageContent, metadata: { category: "sports" } },
      ]);

      // Test with Set values
      const filter = Tag("category").eq(new Set(["electronics", "books"]));
      const results = await tagVectorStore.similaritySearch(
        pageContent,
        10,
        filter
      );

      expect(results.length).toBe(2);
      expect(
        results.every(
          (r) =>
            r.metadata.category === "electronics" ||
            r.metadata.category === "books"
        )
      ).toBe(true);
    } finally {
      await tagVectorStore.delete({ deleteAll: true });
      await tagClient.quit();
    }
  });

  test("numeric filter - eq, gt, gte, lt, lte", async () => {
    const numClient = createClient({ url: process.env.REDIS_URL });
    await numClient.connect();

    const numVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: numClient as RedisClientType,
        indexName: "test-num-index",
        keyPrefix: "test-num:",
        customSchema: [
          { name: "price", type: "numeric" },
          { name: "rating", type: "numeric" },
        ],
      }
    );

    try {
      const pageContent = "Product description";

      await numVectorStore.addDocuments([
        { pageContent, metadata: { price: 50, rating: 4.5 } },
        { pageContent, metadata: { price: 100, rating: 4.0 } },
        { pageContent, metadata: { price: 150, rating: 4.8 } },
        { pageContent, metadata: { price: 200, rating: 3.5 } },
      ]);

      // Test eq
      const eqFilter = Num("price").eq(100);
      const eqResults = await numVectorStore.similaritySearch(
        pageContent,
        10,
        eqFilter
      );
      expect(eqResults.length).toBe(1);
      expect(eqResults[0].metadata.price).toBe(100);

      // Test gt
      const gtFilter = Num("price").gt(100);
      const gtResults = await numVectorStore.similaritySearch(
        pageContent,
        10,
        gtFilter
      );
      expect(gtResults.length).toBe(2);
      expect(gtResults.every((r) => r.metadata.price > 100)).toBe(true);

      // Test gte
      const gteFilter = Num("price").gte(100);
      const gteResults = await numVectorStore.similaritySearch(
        pageContent,
        10,
        gteFilter
      );
      expect(gteResults.length).toBe(3);
      expect(gteResults.every((r) => r.metadata.price >= 100)).toBe(true);

      // Test lt
      const ltFilter = Num("price").lt(150);
      const ltResults = await numVectorStore.similaritySearch(
        pageContent,
        10,
        ltFilter
      );
      expect(ltResults.length).toBe(2);
      expect(ltResults.every((r) => r.metadata.price < 150)).toBe(true);

      // Test lte
      const lteFilter = Num("price").lte(150);
      const lteResults = await numVectorStore.similaritySearch(
        pageContent,
        10,
        lteFilter
      );
      expect(lteResults.length).toBe(3);
      expect(lteResults.every((r) => r.metadata.price <= 150)).toBe(true);
    } finally {
      await numVectorStore.delete({ deleteAll: true });
      await numClient.quit();
    }
  });

  test("numeric filter - between and ne", async () => {
    const numClient = createClient({ url: process.env.REDIS_URL });
    await numClient.connect();

    const numVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: numClient as RedisClientType,
        indexName: "test-num-between-index",
        keyPrefix: "test-num-between:",
        customSchema: [{ name: "price", type: "numeric" }],
      }
    );

    try {
      const pageContent = "Product description";

      await numVectorStore.addDocuments([
        { pageContent, metadata: { price: 50 } },
        { pageContent, metadata: { price: 100 } },
        { pageContent, metadata: { price: 150 } },
        { pageContent, metadata: { price: 200 } },
      ]);

      // Test between
      const betweenFilter = Num("price").between(75, 175);
      const betweenResults = await numVectorStore.similaritySearch(
        pageContent,
        10,
        betweenFilter
      );
      expect(betweenResults.length).toBe(2);
      expect(
        betweenResults.every(
          (r) => r.metadata.price >= 75 && r.metadata.price <= 175
        )
      ).toBe(true);

      // Test ne
      const neFilter = Num("price").ne(100);
      const neResults = await numVectorStore.similaritySearch(
        pageContent,
        10,
        neFilter
      );
      expect(neResults.length).toBe(3);
      expect(neResults.every((r) => r.metadata.price !== 100)).toBe(true);
    } finally {
      await numVectorStore.delete({ deleteAll: true });
      await numClient.quit();
    }
  });

  test("text filter - exact match", async () => {
    const textClient = createClient({ url: process.env.REDIS_URL });
    await textClient.connect();

    const textVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: textClient as RedisClientType,
        indexName: "test-text-index",
        keyPrefix: "test-text:",
        customSchema: [
          { name: "title", type: "text" },
          { name: "description", type: "text" },
        ],
      }
    );

    try {
      const pageContent = "Product description";

      await textVectorStore.addDocuments([
        {
          pageContent,
          metadata: {
            title: "wireless headphones",
            description: "bluetooth audio",
          },
        },
        {
          pageContent,
          metadata: { title: "wired headphones", description: "audio cable" },
        },
        {
          pageContent,
          metadata: { title: "wireless speaker", description: "bluetooth" },
        },
      ]);

      // Test exact match
      const exactFilter = Text("title").eq("wireless headphones");
      const exactResults = await textVectorStore.similaritySearch(
        pageContent,
        10,
        exactFilter
      );
      expect(exactResults.length).toBe(1);
      expect(exactResults[0].metadata.title).toBe("wireless headphones");
    } finally {
      await textVectorStore.delete({ deleteAll: true });
      await textClient.quit();
    }
  });

  test("text filter - wildcard and match", async () => {
    const textClient = createClient({ url: process.env.REDIS_URL });
    await textClient.connect();

    const textVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: textClient as RedisClientType,
        indexName: "test-text-wildcard-index",
        keyPrefix: "test-text-wildcard:",
        customSchema: [{ name: "title", type: "text" }],
      }
    );

    try {
      const pageContent = "Product description";

      await textVectorStore.addDocuments([
        { pageContent, metadata: { title: "wireless headphones" } },
        { pageContent, metadata: { title: "wired headphones" } },
        { pageContent, metadata: { title: "wireless speaker" } },
        { pageContent, metadata: { title: "bluetooth earbuds" } },
      ]);

      // Test wildcard
      const wildcardFilter = Text("title").wildcard("*headphones*");
      const wildcardResults = await textVectorStore.similaritySearch(
        pageContent,
        10,
        wildcardFilter
      );
      expect(wildcardResults.length).toBe(2);
      expect(
        wildcardResults.every((r) => r.metadata.title.includes("headphones"))
      ).toBe(true);

      // Test match (tokenized search)
      const matchFilter = Text("title").match("wireless");
      const matchResults = await textVectorStore.similaritySearch(
        pageContent,
        10,
        matchFilter
      );
      expect(matchResults.length).toBe(2);
      expect(
        matchResults.every((r) => r.metadata.title.includes("wireless"))
      ).toBe(true);
    } finally {
      await textVectorStore.delete({ deleteAll: true });
      await textClient.quit();
    }
  });

  test("text filter - fuzzy and ne", async () => {
    const textClient = createClient({ url: process.env.REDIS_URL });
    await textClient.connect();

    const textVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: textClient as RedisClientType,
        indexName: "test-text-fuzzy-index",
        keyPrefix: "test-text-fuzzy:",
        customSchema: [{ name: "title", type: "text" }],
      }
    );

    try {
      const pageContent = "Product description";

      await textVectorStore.addDocuments([
        { pageContent, metadata: { title: "bluetooth speaker" } },
        { pageContent, metadata: { title: "wireless headphones" } },
        { pageContent, metadata: { title: "wired earbuds" } },
      ]);

      // Test fuzzy (allows typos)
      const fuzzyFilter = Text("title").fuzzy("blutooth");
      const fuzzyResults = await textVectorStore.similaritySearch(
        pageContent,
        10,
        fuzzyFilter
      );
      // Fuzzy search should find "bluetooth" even with typo
      expect(fuzzyResults.length).toBeGreaterThanOrEqual(1);
      expect(
        fuzzyResults.some((r) => r.metadata.title.includes("bluetooth"))
      ).toBe(true);

      // Test ne (negation)
      const neFilter = Text("title").ne("bluetooth speaker");
      const neResults = await textVectorStore.similaritySearch(
        pageContent,
        10,
        neFilter
      );
      expect(neResults.length).toBe(2);
      expect(
        neResults.every((r) => r.metadata.title !== "bluetooth speaker")
      ).toBe(true);
    } finally {
      await textVectorStore.delete({ deleteAll: true });
      await textClient.quit();
    }
  });

  test("timestamp filter - Date objects", async () => {
    const tsClient = createClient({ url: process.env.REDIS_URL });
    await tsClient.connect();

    const tsVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: tsClient as RedisClientType,
        indexName: "test-timestamp-index",
        keyPrefix: "test-timestamp:",
        customSchema: [
          { name: "created_at", type: "numeric" },
          { name: "updated_at", type: "numeric" },
        ],
      }
    );

    try {
      const pageContent = "Document content";
      const date1 = new Date("2023-01-01T00:00:00Z");
      const date2 = new Date("2023-06-01T00:00:00Z");
      const date3 = new Date("2023-09-01T00:00:00Z");
      const date4 = new Date("2023-12-01T00:00:00Z");

      await tsVectorStore.addDocuments([
        {
          pageContent,
          metadata: {
            created_at: Math.floor(date1.getTime() / 1000),
            updated_at: Math.floor(date1.getTime() / 1000),
          },
        },
        {
          pageContent,
          metadata: {
            created_at: Math.floor(date2.getTime() / 1000),
            updated_at: Math.floor(date2.getTime() / 1000),
          },
        },
        {
          pageContent,
          metadata: {
            created_at: Math.floor(date3.getTime() / 1000),
            updated_at: Math.floor(date3.getTime() / 1000),
          },
        },
        {
          pageContent,
          metadata: {
            created_at: Math.floor(date4.getTime() / 1000),
            updated_at: Math.floor(date4.getTime() / 1000),
          },
        },
      ]);

      // Test gt with Date
      const gtFilter = Timestamp("created_at").gt(date2);
      const gtResults = await tsVectorStore.similaritySearch(
        pageContent,
        10,
        gtFilter
      );
      expect(gtResults.length).toBe(2);
      expect(
        gtResults.every(
          (r) => r.metadata.created_at > Math.floor(date2.getTime() / 1000)
        )
      ).toBe(true);

      // Test gte with Date
      const gteFilter = Timestamp("created_at").gte(date2);
      const gteResults = await tsVectorStore.similaritySearch(
        pageContent,
        10,
        gteFilter
      );
      expect(gteResults.length).toBe(3);

      // Test lt with Date
      const ltFilter = Timestamp("created_at").lt(date3);
      const ltResults = await tsVectorStore.similaritySearch(
        pageContent,
        10,
        ltFilter
      );
      expect(ltResults.length).toBe(2);

      // Test between with Date
      const betweenFilter = Timestamp("created_at").between(date2, date3);
      const betweenResults = await tsVectorStore.similaritySearch(
        pageContent,
        10,
        betweenFilter
      );
      expect(betweenResults.length).toBe(2);
    } finally {
      await tsVectorStore.delete({ deleteAll: true });
      await tsClient.quit();
    }
  });

  test("timestamp filter - epoch timestamps", async () => {
    const tsClient = createClient({ url: process.env.REDIS_URL });
    await tsClient.connect();

    const tsVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: tsClient as RedisClientType,
        indexName: "test-timestamp-epoch-index",
        keyPrefix: "test-timestamp-epoch:",
        customSchema: [{ name: "created_at", type: "numeric" }],
      }
    );

    try {
      const pageContent = "Document content";
      const epoch1 = 1672531200; // 2023-01-01
      const epoch2 = 1685577600; // 2023-06-01
      const epoch3 = 1693526400; // 2023-09-01

      await tsVectorStore.addDocuments([
        { pageContent, metadata: { created_at: epoch1 } },
        { pageContent, metadata: { created_at: epoch2 } },
        { pageContent, metadata: { created_at: epoch3 } },
      ]);

      // Test eq with epoch
      const eqFilter = Timestamp("created_at").eq(epoch2);
      const eqResults = await tsVectorStore.similaritySearch(
        pageContent,
        10,
        eqFilter
      );
      expect(eqResults.length).toBe(1);
      expect(eqResults[0].metadata.created_at).toBe(epoch2);

      // Test ne with epoch
      const neFilter = Timestamp("created_at").ne(epoch2);
      const neResults = await tsVectorStore.similaritySearch(
        pageContent,
        10,
        neFilter
      );
      expect(neResults.length).toBe(2);
      expect(neResults.every((r) => r.metadata.created_at !== epoch2)).toBe(
        true
      );
    } finally {
      await tsVectorStore.delete({ deleteAll: true });
      await tsClient.quit();
    }
  });

  test("combined filters - AND operation", async () => {
    const combinedClient = createClient({ url: process.env.REDIS_URL });
    await combinedClient.connect();

    const combinedVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: combinedClient as RedisClientType,
        indexName: "test-combined-and-index",
        keyPrefix: "test-combined-and:",
        customSchema: [
          { name: "category", type: "tag" },
          { name: "price", type: "numeric" },
          { name: "rating", type: "numeric" },
        ],
      }
    );

    try {
      const pageContent = "Product description";

      await combinedVectorStore.addDocuments([
        {
          pageContent,
          metadata: { category: "electronics", price: 50, rating: 4.5 },
        },
        {
          pageContent,
          metadata: { category: "electronics", price: 150, rating: 4.8 },
        },
        {
          pageContent,
          metadata: { category: "books", price: 20, rating: 4.2 },
        },
        {
          pageContent,
          metadata: { category: "electronics", price: 200, rating: 3.5 },
        },
      ]);

      // Test AND: category=electronics AND price < 100
      const andFilter = Tag("category")
        .eq("electronics")
        .and(Num("price").lt(100));
      const andResults = await combinedVectorStore.similaritySearch(
        pageContent,
        10,
        andFilter
      );
      expect(andResults.length).toBe(1);
      expect(andResults[0].metadata.category).toBe("electronics");
      expect(andResults[0].metadata.price).toBe(50);

      // Test multiple AND: category=electronics AND price >= 100 AND rating > 4
      const multiAndFilter = Tag("category")
        .eq("electronics")
        .and(Num("price").gte(100))
        .and(Num("rating").gt(4));
      const multiAndResults = await combinedVectorStore.similaritySearch(
        pageContent,
        10,
        multiAndFilter
      );
      expect(multiAndResults.length).toBe(1);
      expect(multiAndResults[0].metadata.price).toBe(150);
      expect(multiAndResults[0].metadata.rating).toBe(4.8);
    } finally {
      await combinedVectorStore.delete({ deleteAll: true });
      await combinedClient.quit();
    }
  });

  test("combined filters - OR operation", async () => {
    const combinedClient = createClient({ url: process.env.REDIS_URL });
    await combinedClient.connect();

    const combinedVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: combinedClient as RedisClientType,
        indexName: "test-combined-or-index",
        keyPrefix: "test-combined-or:",
        customSchema: [
          { name: "category", type: "tag" },
          { name: "price", type: "numeric" },
        ],
      }
    );

    try {
      const pageContent = "Product description";

      await combinedVectorStore.addDocuments([
        { pageContent, metadata: { category: "electronics", price: 50 } },
        { pageContent, metadata: { category: "books", price: 20 } },
        { pageContent, metadata: { category: "clothing", price: 80 } },
        { pageContent, metadata: { category: "electronics", price: 200 } },
      ]);

      // Test OR: category=books OR price > 150
      const orFilter = Tag("category").eq("books").or(Num("price").gt(150));
      const orResults = await combinedVectorStore.similaritySearch(
        pageContent,
        10,
        orFilter
      );
      expect(orResults.length).toBe(2);
      expect(
        orResults.some((r) => r.metadata.category === "books") &&
          orResults.some((r) => r.metadata.price > 150)
      ).toBe(true);
    } finally {
      await combinedVectorStore.delete({ deleteAll: true });
      await combinedClient.quit();
    }
  });

  test("combined filters - complex nested AND/OR", async () => {
    const combinedClient = createClient({ url: process.env.REDIS_URL });
    await combinedClient.connect();

    const combinedVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: combinedClient as RedisClientType,
        indexName: "test-combined-complex-index",
        keyPrefix: "test-combined-complex:",
        customSchema: [
          { name: "category", type: "tag" },
          { name: "brand", type: "tag" },
          { name: "price", type: "numeric" },
        ],
      }
    );

    try {
      const pageContent = "Product description";

      await combinedVectorStore.addDocuments([
        {
          pageContent,
          metadata: { category: "electronics", brand: "Apple", price: 999 },
        },
        {
          pageContent,
          metadata: { category: "electronics", brand: "Samsung", price: 799 },
        },
        {
          pageContent,
          metadata: { category: "books", brand: "Penguin", price: 15 },
        },
        {
          pageContent,
          metadata: { category: "electronics", brand: "Sony", price: 599 },
        },
      ]);

      // Test complex: (category=electronics AND price < 800) OR brand=Penguin
      const complexFilter = Tag("category")
        .eq("electronics")
        .and(Num("price").lt(800))
        .or(Tag("brand").eq("Penguin"));
      const complexResults = await combinedVectorStore.similaritySearch(
        pageContent,
        10,
        complexFilter
      );
      expect(complexResults.length).toBe(3);
      expect(
        complexResults.some((r) => r.metadata.brand === "Samsung") &&
          complexResults.some((r) => r.metadata.brand === "Sony") &&
          complexResults.some((r) => r.metadata.brand === "Penguin")
      ).toBe(true);
    } finally {
      await combinedVectorStore.delete({ deleteAll: true });
      await combinedClient.quit();
    }
  });

  test("combined filters - mixing all filter types", async () => {
    const mixedClient = createClient({ url: process.env.REDIS_URL });
    await mixedClient.connect();

    const mixedVectorStore = new FluentRedisVectorStore(
      new SyntheticEmbeddings(),
      {
        redisClient: mixedClient as RedisClientType,
        indexName: "test-mixed-filters-index",
        keyPrefix: "test-mixed-filters:",
        customSchema: [
          { name: "category", type: "tag" },
          { name: "title", type: "text" },
          { name: "price", type: "numeric" },
          { name: "created_at", type: "numeric" },
        ],
      }
    );

    try {
      const pageContent = "Product description";
      const date1 = new Date("2023-01-01T00:00:00Z");
      const date2 = new Date("2023-06-01T00:00:00Z");

      await mixedVectorStore.addDocuments([
        {
          pageContent,
          metadata: {
            category: "electronics",
            title: "wireless headphones",
            price: 99,
            created_at: Math.floor(date1.getTime() / 1000),
          },
        },
        {
          pageContent,
          metadata: {
            category: "electronics",
            title: "bluetooth speaker",
            price: 149,
            created_at: Math.floor(date2.getTime() / 1000),
          },
        },
        {
          pageContent,
          metadata: {
            category: "books",
            title: "wireless networking guide",
            price: 29,
            created_at: Math.floor(date2.getTime() / 1000),
          },
        },
      ]);

      // Test mixing Tag, Text, Numeric, and Timestamp filters
      // Find: category=electronics AND title contains "wireless" AND price < 120 AND created after 2022
      const mixedFilter = Tag("category")
        .eq("electronics")
        .and(Text("title").match("wireless"))
        .and(Num("price").lt(120))
        .and(Timestamp("created_at").gt(new Date("2022-01-01T00:00:00Z")));

      const mixedResults = await mixedVectorStore.similaritySearch(
        pageContent,
        10,
        mixedFilter
      );

      expect(mixedResults.length).toBe(1);
      expect(mixedResults[0].metadata.category).toBe("electronics");
      expect(mixedResults[0].metadata.title).toBe("wireless headphones");
      expect(mixedResults[0].metadata.price).toBe(99);
    } finally {
      await mixedVectorStore.delete({ deleteAll: true });
      await mixedClient.quit();
    }
  });
});
