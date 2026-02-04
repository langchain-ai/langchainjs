import { AzureCosmosDBNoSQLVectorStore } from "@langchain/azure-cosmosdb";
import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * This example demonstrates the advanced search capabilities of
 * Azure Cosmos DB for NoSQL vector store including:
 * - Vector search with score threshold
 * - Maximal Marginal Relevance (MMR) search
 * - Using the custom Cosmos retriever
 */

// Create Azure Cosmos DB vector store
const store = await AzureCosmosDBNoSQLVectorStore.fromTexts(
  [
    "Machine learning is a subset of artificial intelligence.",
    "Deep learning uses neural networks with many layers.",
    "Natural language processing enables computers to understand text.",
    "Computer vision allows machines to interpret images.",
    "Reinforcement learning trains agents through rewards.",
  ],
  [
    { category: "ml" },
    { category: "dl" },
    { category: "nlp" },
    { category: "cv" },
    { category: "rl" },
  ],
  new OpenAIEmbeddings(),
  {
    databaseName: "langchain",
    containerName: "advanced-search-demo",
  }
);

// 1. Vector search with score threshold
// Only returns results with similarity score >= threshold
console.log("=== Vector Search with Threshold ===");
const thresholdResults = await store.vectorSearchWithThreshold(
  "What is machine learning?",
  10, // k - number of results
  0.7 // threshold - minimum similarity score
);

for (const [doc, score] of thresholdResults) {
  console.log(`Score: ${score.toFixed(4)}, Content: ${doc.pageContent}`);
}

// 2. Maximal Marginal Relevance (MMR) search
// Balances relevance with diversity in results
console.log("\n=== MMR Search ===");
const mmrResults = await store.maxMarginalRelevanceSearch("neural networks", {
  k: 3, // Number of results to return
  fetchK: 10, // Number of candidates to consider
  lambda: 0.5, // 0 = max diversity, 1 = max relevance
});

for (const doc of mmrResults) {
  console.log(`Content: ${doc.pageContent}`);
}

// 3. MMR search by vector
// Same as above but accepts a pre-computed embedding
console.log("\n=== MMR Search by Vector ===");
const queryEmbedding = await new OpenAIEmbeddings().embedQuery(
  "artificial intelligence"
);
const mmrByVectorResults = await store.maxMarginalRelevanceSearchByVector(
  queryEmbedding,
  {
    k: 3,
    fetchK: 10,
    lambda: 0.3, // More diversity
  }
);

for (const doc of mmrByVectorResults) {
  console.log(`Content: ${doc.pageContent}`);
}

// 4. Using the custom Cosmos retriever
// Supports multiple search types in a unified interface
console.log("\n=== Custom Cosmos Retriever ===");

// Create retriever with vector_score_threshold search type
const retriever = store.asCosmosRetriever({
  searchType: "vector_score_threshold",
  k: 5,
  searchKwargs: {
    scoreThreshold: 0.6,
  },
});

const retrieverDocs = await retriever.invoke("How do neural networks work?");
console.log(`Found ${retrieverDocs.length} documents above threshold`);

for (const doc of retrieverDocs) {
  console.log(`Content: ${doc.pageContent}`);
}

// Create retriever with MMR search type
const mmrRetriever = store.asCosmosRetriever({
  searchType: "mmr",
  k: 3,
  searchKwargs: {
    fetchK: 10,
    lambda: 0.5,
  },
});

const mmrRetrieverDocs = await mmrRetriever.invoke("AI and machine learning");
console.log(`\nMMR Retriever found ${mmrRetrieverDocs.length} documents`);

// Clean up
await store.delete();

console.log("\nDone!");
