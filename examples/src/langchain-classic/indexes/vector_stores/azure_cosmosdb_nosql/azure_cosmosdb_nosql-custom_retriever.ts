import { AzureCosmosDBNoSQLVectorStore } from "@langchain/azure-cosmosdb";
import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * This example demonstrates the custom retriever for Azure Cosmos DB NoSQL
 * which supports multiple search types including:
 * - similarity / vector: Standard vector similarity search
 * - vector_score_threshold: Vector search with minimum score filter
 * - mmr: Maximal Marginal Relevance search
 * - full_text_search: Full-text search (preview feature)
 * - full_text_ranking: Full-text search with BM25 ranking (preview feature)
 * - hybrid: Hybrid vector + full-text search (preview feature)
 * - hybrid_score_threshold: Hybrid search with score threshold (preview feature)
 */

// Create Azure Cosmos DB vector store
const store = await AzureCosmosDBNoSQLVectorStore.fromTexts(
  [
    "The quick brown fox jumps over the lazy dog.",
    "Machine learning is a subset of artificial intelligence.",
    "Deep learning uses neural networks with many layers.",
    "Natural language processing enables computers to understand text.",
    "Computer vision allows machines to interpret images.",
  ],
  [
    { category: "text" },
    { category: "ml" },
    { category: "dl" },
    { category: "nlp" },
    { category: "cv" },
  ],
  new OpenAIEmbeddings(),
  {
    databaseName: "langchain",
    containerName: "retriever-demo",
  }
);

// 1. Standard vector similarity search
console.log("=== Vector Search (similarity) ===");
const vectorRetriever = store.asCosmosRetriever({
  searchType: "vector",
  k: 3,
});

const vectorDocs = await vectorRetriever.invoke("artificial intelligence");
for (const doc of vectorDocs) {
  console.log(`- ${doc.pageContent}`);
}

// 2. Vector search with score threshold
console.log("\n=== Vector Search with Score Threshold ===");
const thresholdRetriever = store.asCosmosRetriever({
  searchType: "vector_score_threshold",
  k: 10,
  searchKwargs: {
    scoreThreshold: 0.75,
  },
});

const thresholdDocs = await thresholdRetriever.invoke("neural networks");
console.log(`Found ${thresholdDocs.length} documents with score >= 0.75`);
for (const doc of thresholdDocs) {
  console.log(`- ${doc.pageContent}`);
}

// 3. MMR search for diverse results
console.log("\n=== MMR Search ===");
const mmrRetriever = store.asCosmosRetriever({
  searchType: "mmr",
  k: 3,
  searchKwargs: {
    fetchK: 10,
    lambda: 0.3, // Lower = more diversity
  },
});

const mmrDocs = await mmrRetriever.invoke("AI technology");
for (const doc of mmrDocs) {
  console.log(`- ${doc.pageContent}`);
}

// 4. Using with filters
console.log("\n=== Vector Search with Filter ===");
const filteredRetriever = store.asCosmosRetriever({
  searchType: "vector",
  k: 5,
  searchKwargs: {
    filterClause:
      "WHERE c.metadata.category = 'ml' OR c.metadata.category = 'dl'",
  },
});

const filteredDocs = await filteredRetriever.invoke("machine learning");
console.log(`Found ${filteredDocs.length} documents in ml/dl categories`);
for (const doc of filteredDocs) {
  console.log(`- [${doc.metadata.category}] ${doc.pageContent}`);
}

// Clean up
await store.delete();

console.log("\nDone!");
