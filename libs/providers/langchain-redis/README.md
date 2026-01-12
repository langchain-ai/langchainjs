# @langchain/redis

This package contains the LangChain.js integrations for Redis through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/redis @langchain/core
```

## Development

To develop the Redis package, you'll need to follow these instructions:

### Install dependencies

```bash
pnpm install
```

### Build the package

```bash
pnpm build
```

Or from the repo root:

```bash
pnpm build --filter @langchain/redis
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
$ pnpm test
$ pnpm test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
pnpm lint && pnpm format
```

#### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `pnpm build` to generate the new entrypoint.

## Migration Guide: RedisVectorStore to FluentRedisVectorStore

The `FluentRedisVectorStore` is the recommended approach for new projects. It provides a more powerful and type-safe filtering API with support for complex metadata queries. This guide helps you migrate from the legacy `RedisVectorStore` to `FluentRedisVectorStore`.

### Key Differences

| Feature                            | RedisVectorStore                           | FluentRedisVectorStore                       |
|------------------------------------|--------------------------------------------|----------------------------------------------|
| **Metadata Schema Definition**     | `Record<string, CustomSchemaField>`        | `MetadataFieldSchema[]`                      |
| **Inferred Metadata Schema**       | No, only custom schema supported           | Yes, based on metadata when adding documents |
| **Pre-filter - Definition**        | String arrays or raw query strings         | Type-safe `FilterExpression` objects         |
| **Pre-filter - Nested conditions** | All filters joined by single AND condition | AND, OR, nesting supported                   |
| **Pre-filter - conditions types**  | Numeric, Tag and Text                      | Numeric, Tag, Text, Geo, Timestamp           |
| **Metadata Storage**               | JSON blob + optional indexed fields        | Individual indexed fields (no JSON blob)     |

### Step 1: Update Imports

**Before (RedisVectorStore):**
```typescript
import { RedisVectorStore } from "@langchain/redis";
```

**After (FluentRedisVectorStore):**
```typescript
import { FluentRedisVectorStore, Tag, Num, Text, Geo } from "@langchain/redis";
```

### Step 2: Convert Metadata Schema

The schema format has changed from an object-based to an array-based structure.

**Before (RedisVectorStore):**
```typescript
const customSchema = {
  userId: { type: SchemaFieldTypes.TAG, required: true },
  price: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true },
  description: { type: SchemaFieldTypes.TEXT },
  location: { type: SchemaFieldTypes.GEO }
};
```

**After (FluentRedisVectorStore):**
```typescript
const customSchema = [
  { name: "userId", type: "tag" },
  { name: "price", type: "numeric", options: { sortable: true } },
  { name: "description", type: "text" },
  { name: "location", type: "geo" }
];
```

### Step 3: Update Configuration

**Before:**
```typescript
const vectorStore = await RedisVectorStore.fromDocuments(
  documents,
  embeddings,
  {
    redisClient: client,
    indexName: "products",
    customSchema: {
      category: { type: SchemaFieldTypes.TAG },
      price: { type: SchemaFieldTypes.NUMERIC, SORTABLE: true }
    }
  }
);
```

**After:**
```typescript
const vectorStore = await FluentRedisVectorStore.fromDocuments(
  documents,
  embeddings,
  {
    redisClient: client,
    indexName: "products",
    customSchema: [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric", options: { sortable: true } }
    ]
  }
);
```

### Step 4: Update Search Queries with Filters

The filtering API has changed significantly. Instead of passing metadata objects or string arrays, you now use fluent filter expressions.

**Before (RedisVectorStore):**
```typescript
// Simple metadata filtering
const results = await vectorStore.similaritySearchVectorWithScoreAndMetadata(
  queryVector,
  5,
  { category: "electronics", price: { min: 100, max: 1000 } }
);

// Or with string-based filters
const results = await vectorStore.similaritySearchVectorWithScore(
  queryVector,
  5,
  ["electronics", "gadgets"]
);
```

**After (FluentRedisVectorStore):**
```typescript
// Custom filter expression with the fluent API
const results = await vectorStore.similaritySearchVectorWithScore(
  queryVector,
  5,
  Tag("category").eq("electronics").and(Num("price").between(100,1000)
  )
);

// Basic filter expression with the fluent API
const results = await vectorStore.similaritySearchVectorWithScore(
  queryVector,
  5,
  Tag("metadata").eq("electronics", "gadgets")
);
```

### Step 5: Database Schema Migration

The `FluentRedisVectorStore` only supports metadata stored in individual fields, alongside the vector data and content data. 
It is not compatible with the implementation of the RedisVectorStore which stores metadata as a JSON blob in a single field.
The custom schema option of the `RedisVectorStore` could be migrated to the `FluentRedisVectorStore` following the instructions in step 2.

To avoid ambiguous results, it's recommended to create a new index with the updated schema and migrate data.

### Step 6: Update Application Code

Replace all instances of `RedisVectorStore` with `FluentRedisVectorStore` and update filter usage:

**Before:**
```typescript
async function searchProducts(query: string, category?: string) {
  const results = await vectorStore.similaritySearchVectorWithScoreAndMetadata(
    await embeddings.embedQuery(query),
    5,
    category ? { category } : undefined
  );
  return results;
}
```

**After:**
```typescript
async function searchProducts(query: string, category?: string) {
  const filter = category ? Tag("category").eq(category) : undefined;
  const results = await vectorStore.similaritySearchVectorWithScore(
    await embeddings.embedQuery(query),
    5,
    filter
  );
  return results;
}
```