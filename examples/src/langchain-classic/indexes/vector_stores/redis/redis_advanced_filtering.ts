/**
 * Advanced Redis Vector Store Filtering Examples
 *
 * This example demonstrates all the advanced filtering capabilities of RedisVectorStore:
 * - Tag filters for categorical data
 * - Numeric filters for ranges and comparisons
 * - Text filters for full-text search
 * - Geo filters for location-based queries
 * - Timestamp filters for date/time queries
 * - Complex combinations with AND/OR logic
 * - Custom filters with raw RediSearch query syntax
 *
 * Note: Timestamps are stored as numeric fields (Unix epoch timestamps).
 * Date objects are automatically converted during serialization and returned
 * as numbers during deserialization.
 */

import { createClient } from "redis";
import { OpenAIEmbeddings } from "@langchain/openai";
import {
  RedisVectorStore,
  Tag,
  Num,
  Text,
  Geo,
  Timestamp,
  Custom,
} from "@langchain/redis";
import { Document } from "@langchain/core/documents";

// Connect to Redis
const client = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});
await client.connect();

// Sample documents with rich metadata
const docs = [
  new Document({
    metadata: {
      category: "electronics",
      price: 299.99,
      title: "Wireless Bluetooth Headphones",
      location: [-122.4194, 37.7749], // San Francisco
      created_at: new Date("2023-01-15"),
      brand: "TechCorp",
      rating: 4.5,
    },
    pageContent:
      "High-quality wireless Bluetooth headphones with noise cancellation",
  }),
  new Document({
    metadata: {
      category: "books",
      price: 24.99,
      title: "JavaScript Programming Guide",
      location: [-74.006, 40.7128], // New York
      created_at: new Date("2023-03-20"),
      author: "John Smith",
      pages: 450,
    },
    pageContent:
      "Comprehensive guide to modern JavaScript programming techniques",
  }),
  new Document({
    metadata: {
      category: "electronics",
      price: 899.99,
      title: "4K Smart TV",
      location: [-118.2437, 34.0522], // Los Angeles
      created_at: new Date("2023-02-10"),
      brand: "ViewTech",
      screen_size: 55,
    },
    pageContent:
      "Ultra HD 4K Smart TV with streaming capabilities and voice control",
  }),
  new Document({
    metadata: {
      category: "books",
      price: 19.99,
      title: "Machine Learning Basics",
      location: [-122.4194, 37.7749], // San Francisco
      created_at: new Date("2023-04-05"),
      author: "Jane Doe",
      pages: 320,
    },
    pageContent:
      "Introduction to machine learning concepts and practical applications",
  }),
];

// Create vector store with metadata schema for proper indexing
const vectorStore = await RedisVectorStore.fromDocuments(
  docs,
  new OpenAIEmbeddings(),
  {
    redisClient: client,
    indexName: "advanced_products",
    customSchema: [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric", options: { sortable: true } },
      { name: "title", type: "text", options: { weight: 2.0 } },
      { name: "location", type: "geo" },
      // Timestamps are stored as numeric fields (Unix epoch timestamps)
      { name: "created_at", type: "numeric", options: { sortable: true } },
      { name: "brand", type: "tag" },
      { name: "author", type: "tag" },
      { name: "rating", type: "numeric" },
      { name: "pages", type: "numeric" },
      { name: "screen_size", type: "numeric" },
    ],
  }
);

console.log("=== Advanced Redis Vector Store Filtering Examples ===\n");

// Example 1: Simple tag filtering
console.log("1. Simple tag filtering - Electronics only:");
const electronicsFilter = Tag("category").eq("electronics");
const electronicsResults = await vectorStore.similaritySearch(
  "high quality device",
  5,
  electronicsFilter
);
console.log(`Found ${electronicsResults.length} electronics items`);
electronicsResults.forEach((doc) =>
  console.log(`- ${doc.metadata.title} ($${doc.metadata.price})`)
);
console.log();

// Example 2: Numeric range filtering
console.log("2. Numeric range filtering - Products between $20-$500:");
const priceFilter = Num("price").between(20, 500);
const priceResults = await vectorStore.similaritySearch(
  "quality product",
  5,
  priceFilter
);
console.log(`Found ${priceResults.length} products in price range`);
priceResults.forEach((doc) =>
  console.log(`- ${doc.metadata.title} ($${doc.metadata.price})`)
);
console.log();

// Example 3: Text search filtering
console.log("3. Text search filtering - Titles containing 'programming':");
const textFilter = Text("title").wildcard("*programming*");
const textResults = await vectorStore.similaritySearch(
  "learning guide",
  5,
  textFilter
);
console.log(`Found ${textResults.length} programming-related items`);
textResults.forEach((doc) =>
  console.log(`- ${doc.metadata.title} by ${doc.metadata.author || "N/A"}`)
);
console.log();

// Example 4: Geographic filtering
console.log("4. Geographic filtering - Items within 50km of San Francisco:");
const geoFilter = Geo("location").within(-122.4194, 37.7749, 50, "km");
const geoResults = await vectorStore.similaritySearch(
  "local products",
  5,
  geoFilter
);
console.log(`Found ${geoResults.length} items near San Francisco`);
geoResults.forEach((doc) =>
  console.log(`- ${doc.metadata.title} (${doc.metadata.location})`)
);
console.log();

// Example 5: Timestamp filtering
console.log("5. Timestamp filtering - Items created after March 1, 2023:");
const timestampFilter = Timestamp("created_at").gt(new Date("2023-03-01"));
const timestampResults = await vectorStore.similaritySearch(
  "recent items",
  5,
  timestampFilter
);
console.log(`Found ${timestampResults.length} recent items`);
timestampResults.forEach((doc) => {
  // created_at is stored as a Unix epoch timestamp (number)
  // Convert it back to a Date for display
  const createdDate = new Date((doc.metadata.created_at as number) * 1000);
  console.log(`- ${doc.metadata.title} (${createdDate.toDateString()})`);
});
console.log();

// Example 6: Complex combined filtering
console.log("6. Complex filtering - Electronics under $400 in California:");
const complexFilter = Tag("category")
  .eq("electronics")
  .and(Num("price").lt(400))
  .and(Geo("location").within(-119.4179, 36.7783, 500, "km")); // California center

const complexResults = await vectorStore.similaritySearch(
  "affordable electronics",
  5,
  complexFilter
);
console.log(
  `Found ${complexResults.length} affordable electronics in California`
);
complexResults.forEach((doc) =>
  console.log(
    `- ${doc.metadata.title} ($${doc.metadata.price}) at ${doc.metadata.location}`
  )
);
console.log();

// Example 7: OR filtering
console.log("7. OR filtering - Books OR items under $30:");
const orFilter = Tag("category").eq("books").or(Num("price").lt(30));
const orResults = await vectorStore.similaritySearch(
  "affordable items",
  5,
  orFilter
);
console.log(`Found ${orResults.length} books or cheap items`);
orResults.forEach((doc) =>
  console.log(
    `- ${doc.metadata.title} (${doc.metadata.category}, $${doc.metadata.price})`
  )
);
console.log();

// Example 8: Multiple tag values
console.log("8. Multiple tag values - TechCorp OR ViewTech brands:");
const multiTagFilter = Tag("brand").eq(["TechCorp", "ViewTech"]);
const multiTagResults = await vectorStore.similaritySearch(
  "branded products",
  5,
  multiTagFilter
);
console.log(`Found ${multiTagResults.length} items from specified brands`);
multiTagResults.forEach((doc) =>
  console.log(`- ${doc.metadata.title} by ${doc.metadata.brand}`)
);
console.log();

// Example 9: Negation filtering
console.log("9. Negation filtering - NOT electronics:");
const negationFilter = Tag("category").ne("electronics");
const negationResults = await vectorStore.similaritySearch(
  "non-electronic items",
  5,
  negationFilter
);
console.log(`Found ${negationResults.length} non-electronic items`);
negationResults.forEach((doc) =>
  console.log(`- ${doc.metadata.title} (${doc.metadata.category})`)
);
console.log();

// Example 10: Custom filter with raw RediSearch syntax
console.log("10. Custom filter - Raw RediSearch query syntax:");
const customFilter = Custom("(@category:{electronics} @price:[0 400])");
const customResults = await vectorStore.similaritySearch(
  "affordable tech",
  5,
  customFilter
);
console.log(`Found ${customResults.length} affordable electronics`);
customResults.forEach((doc) =>
  console.log(`- ${doc.metadata.title} ($${doc.metadata.price})`)
);
console.log();

// Cleanup
await vectorStore.delete({ deleteAll: true });
await client.disconnect();

console.log("\n=== Advanced filtering examples completed! ===");
