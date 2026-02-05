import { Client, ClientOptions } from "@elastic/elasticsearch";
import { OpenAIEmbeddings } from "@langchain/openai";
import {
  ElasticClientArgs,
  ElasticVectorSearch,
  HybridRetrievalStrategy,
} from "@langchain/community/vectorstores/elasticsearch";
import { Document } from "@langchain/core/documents";

/**
 * Demonstrates hybrid search with Elasticsearch, combining:
 * - Vector (semantic) search using embeddings
 * - BM25 (lexical) full-text search
 * - Reciprocal Rank Fusion (RRF) for result merging
 *
 * Requirements:
 * - Elasticsearch 8.9+ (for RRF support)
 * - Run: docker-compose up -d --build (in elasticsearch directory)
 * - Set ELASTIC_URL, ELASTIC_API_KEY (or ELASTIC_USERNAME/ELASTIC_PASSWORD)
 */
export async function run() {
  const config: ClientOptions = {
    node: process.env.ELASTIC_URL ?? "http://127.0.0.1:9200",
  };
  if (process.env.ELASTIC_API_KEY) {
    config.auth = {
      apiKey: process.env.ELASTIC_API_KEY,
    };
  } else if (process.env.ELASTIC_USERNAME && process.env.ELASTIC_PASSWORD) {
    config.auth = {
      username: process.env.ELASTIC_USERNAME,
      password: process.env.ELASTIC_PASSWORD,
    };
  }

  const embeddings = new OpenAIEmbeddings();

  const clientArgs: ElasticClientArgs = {
    client: new Client(config),
    indexName: process.env.ELASTIC_INDEX ?? "test_hybrid_search",
    strategy: new HybridRetrievalStrategy({
      rankWindowSize: 100,
      rankConstant: 60,
      textField: "text",
    }),
  };

  const vectorStore = new ElasticVectorSearch(embeddings, clientArgs);

  await vectorStore.deleteIfExists();

  // Add sample documents
  const docs = [
    new Document({
      pageContent:
        "Running helps build cardiovascular endurance and strengthens leg muscles.",
      metadata: { category: "fitness", topic: "running" },
    }),
    new Document({
      pageContent:
        "Marathon training requires consistent mileage and proper recovery.",
      metadata: { category: "fitness", topic: "running" },
    }),
    new Document({
      pageContent:
        "Muscle soreness after exercise is caused by microscopic damage to muscle fibers.",
      metadata: { category: "health", topic: "recovery" },
    }),
    new Document({
      pageContent:
        "Stretching and foam rolling can help prevent post-workout muscle pain.",
      metadata: { category: "health", topic: "recovery" },
    }),
    new Document({
      pageContent:
        "Python is a popular programming language for data science and machine learning.",
      metadata: { category: "technology", topic: "programming" },
    }),
  ];

  console.log("Adding documents to Elasticsearch...");
  await vectorStore.addDocuments(docs);
  console.log("Documents added successfully!\n");

  // Example 1: Hybrid search combines semantic + keyword matching
  console.log("=== Example 1: Hybrid Search ===");
  const query1 = "How to avoid muscle soreness while running?";
  console.log(`Query: "${query1}"\n`);

  const results1 = await vectorStore.similaritySearchWithScore(query1, 3);
  results1.forEach(([doc, score], i) => {
    console.log(`${i + 1}. [Score: ${score.toFixed(4)}] ${doc.pageContent}`);
    console.log(`   Metadata: ${JSON.stringify(doc.metadata)}\n`);
  });

  // Example 2: Semantic search works well for conceptual queries
  console.log("\n=== Example 2: Semantic Query ===");
  const query2 = "tips for preventing pain after workouts";
  console.log(`Query: "${query2}"\n`);

  const results2 = await vectorStore.similaritySearchWithScore(query2, 2);
  results2.forEach(([doc, score], i) => {
    console.log(`${i + 1}. [Score: ${score.toFixed(4)}] ${doc.pageContent}`);
    console.log(`   Metadata: ${JSON.stringify(doc.metadata)}\n`);
  });

  // Example 3: With metadata filters
  console.log("\n=== Example 3: Hybrid Search with Filters ===");
  const query3 = "fitness advice";
  console.log(`Query: "${query3}"`);
  console.log(`Filter: category = "fitness"\n`);

  const results3 = await vectorStore.similaritySearchWithScore(query3, 3, {
    category: "fitness",
  });
  results3.forEach(([doc, score], i) => {
    console.log(`${i + 1}. [Score: ${score.toFixed(4)}] ${doc.pageContent}`);
    console.log(`   Metadata: ${JSON.stringify(doc.metadata)}\n`);
  });

  // Clean up
  console.log("\n=== Cleanup ===");
  await vectorStore.deleteIfExists();
  console.log("Index deleted.");
}
