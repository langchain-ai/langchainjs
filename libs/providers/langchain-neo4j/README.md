# @langchain/neo4j

This package contains the [LangChain.js](https://github.com/langchain-ai/langchainjs) integrations for [Neo4j](https://neo4j.com/) graph database, including support for [Memgraph](https://memgraph.com/) (which uses the Bolt protocol).

## Installation

```bash
npm install @langchain/neo4j @langchain/core
```

You also need to have `neo4j-driver` installed (it is included as a dependency of this package).

## Components

### Neo4jGraph

A wrapper around the Neo4j database that provides schema introspection and query execution.

```typescript
import { Neo4jGraph } from "@langchain/neo4j";

const graph = await Neo4jGraph.initialize({
  url: "bolt://localhost:7687",
  username: "neo4j",
  password: "password",
  database: "neo4j", // optional, defaults to "neo4j"
});

// Get the database schema
console.log(graph.getSchema());

// Run a Cypher query
const results = await graph.query("MATCH (n:Person) RETURN n.name LIMIT 10");

// Clean up
await graph.close();
```

#### Enhanced Schema

You can enable enhanced schema introspection to get more detailed information about node and relationship properties, including value distributions, min/max ranges, and distinct counts:

```typescript
const graph = await Neo4jGraph.initialize({
  url: "bolt://localhost:7687",
  username: "neo4j",
  password: "password",
  enhancedSchema: true,
});
```

#### Graph Documents

You can add structured graph documents (nodes and relationships extracted from text) to the database:

```typescript
import { Neo4jGraph, Node, Relationship, GraphDocument } from "@langchain/neo4j";
import { Document } from "@langchain/core/documents";

const source = new Document({
  pageContent: "Alice works at Acme Corp.",
  metadata: { id: "doc1" },
});

const alice = new Node({ id: "alice", type: "Person", properties: { name: "Alice" } });
const acme = new Node({ id: "acme", type: "Company", properties: { name: "Acme Corp" } });
const worksAt = new Relationship({
  source: alice,
  target: acme,
  type: "WORKS_AT",
});

const graphDoc = new GraphDocument({
  nodes: [alice, acme],
  relationships: [worksAt],
  source,
});

await graph.addGraphDocuments([graphDoc]);
```

### Neo4jVectorStore

A vector store implementation backed by Neo4j's vector index capabilities. Supports vector search, hybrid search (vector + full-text), and metadata filtering.

```typescript
import { Neo4jVectorStore } from "@langchain/neo4j";
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings();

// Create from documents
const vectorStore = await Neo4jVectorStore.fromDocuments(docs, embeddings, {
  url: "bolt://localhost:7687",
  username: "neo4j",
  password: "password",
  indexName: "vector",
  nodeLabel: "Chunk",
  textNodeProperty: "text",
  embeddingNodeProperty: "embedding",
});

// Similarity search
const results = await vectorStore.similaritySearch("What is Neo4j?", 4);

// Similarity search with score
const resultsWithScore = await vectorStore.similaritySearchWithScore(
  "What is Neo4j?",
  4
);

// Clean up
await vectorStore.close();
```

#### Hybrid Search

Combine vector search with full-text search for improved retrieval:

```typescript
const vectorStore = await Neo4jVectorStore.fromDocuments(docs, embeddings, {
  url: "bolt://localhost:7687",
  username: "neo4j",
  password: "password",
  searchType: "hybrid",
  indexName: "vector",
  keywordIndexName: "keyword",
  nodeLabel: "Chunk",
});
```

#### Using an Existing Index

Connect to a pre-existing vector index:

```typescript
const vectorStore = await Neo4jVectorStore.fromExistingIndex(embeddings, {
  url: "bolt://localhost:7687",
  username: "neo4j",
  password: "password",
  indexName: "my_existing_index",
});
```

#### Metadata Filtering

Filter search results by node properties (requires Neo4j 5.18+):

```typescript
const results = await vectorStore.similaritySearch("query", 4, {
  filter: {
    category: "science",
    year: { $gte: 2020 },
  },
});
```

Supported filter operators: `$eq`, `$ne`, `$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$nin`, `$like`, `$ilike`, `$between`, `$and`, `$or`.

### Neo4jChatMessageHistory

Persist chat message history in a Neo4j database:

```typescript
import { Neo4jChatMessageHistory } from "@langchain/neo4j";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const history = await Neo4jChatMessageHistory.initialize({
  url: "bolt://localhost:7687",
  username: "neo4j",
  password: "password",
  sessionId: "my-session-id", // optional, auto-generated if not provided
  windowSize: 5, // optional, defaults to 3
});

// Add messages
await history.addMessage(new HumanMessage("Hello!"));
await history.addMessage(new AIMessage("Hi there! How can I help you?"));

// Retrieve messages
const messages = await history.getMessages();

// Clear history
await history.clear();

// Clean up
await history.close();
```

### GraphCypherQAChain

A chain for question-answering against a Neo4j graph database by generating Cypher statements. Requires `@langchain/classic` as an optional dependency.

```typescript
import { Neo4jGraph, GraphCypherQAChain } from "@langchain/neo4j";
import { ChatOpenAI } from "@langchain/openai";

const graph = await Neo4jGraph.initialize({
  url: "bolt://localhost:7687",
  username: "neo4j",
  password: "password",
});

const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

const chain = GraphCypherQAChain.fromLLM({
  graph,
  llm,
  returnIntermediateSteps: true,
});

const result = await chain.invoke({ query: "Who played in Pulp Fiction?" });
console.log(result.result);
```

You can also use separate LLMs for Cypher generation and answer synthesis:

```typescript
const chain = GraphCypherQAChain.fromLLM({
  graph,
  cypherLLM: new ChatOpenAI({ model: "gpt-4o", temperature: 0 }),
  qaLLM: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
});
```

### MemgraphGraph

A subclass of `Neo4jGraph` for use with [Memgraph](https://memgraph.com/), which is compatible with the Bolt protocol:

```typescript
import { MemgraphGraph } from "@langchain/neo4j";

const graph = await MemgraphGraph.initialize({
  url: "bolt://localhost:7687",
  username: "memgraph",
  password: "password",
});

console.log(graph.getSchema());
await graph.close();
```

## Security

All database components in this package accept connection credentials. Make sure that the database connection uses credentials that are narrowly-scoped to only include necessary permissions. See the [LangChain security documentation](https://js.langchain.com/docs/security) for more information.

## Migration from `@langchain/community`

If you were previously using Neo4j integrations from `@langchain/community`, update your imports:

```typescript
// Before
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { Neo4jChatMessageHistory } from "@langchain/community/stores/message/neo4j";
import { GraphCypherQAChain } from "@langchain/community/chains/graph_qa/cypher";

// After
import {
  Neo4jGraph,
  Neo4jVectorStore,
  Neo4jChatMessageHistory,
  GraphCypherQAChain,
} from "@langchain/neo4j";
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm --filter @langchain/neo4j build

# Run tests
pnpm --filter @langchain/neo4j test

# Lint
pnpm --filter @langchain/neo4j lint
```
