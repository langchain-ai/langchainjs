import { MongoClient } from "mongodb";
import { MongoDBAtlasSemanticCache } from "@langchain/mongodb";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

// Connect to MongoDB Atlas
const uri = process.env.MONGODB_ATLAS_URI;
if (!uri) {
  throw new Error("MONGODB_ATLAS_URI environment variable is not set.");
}
const client = new MongoClient(uri);
await client.connect();
const db = client.db("langchain");

// Use a collection for the semantic cache
const llmSemCacheCollection = db.collection("llm_semantic_cache");

// Set up OpenAI embeddings
const embeddings = new OpenAIEmbeddings();

// Set up the semantic cache with a similarity threshold (optional)
const cache = new MongoDBAtlasSemanticCache(llmSemCacheCollection, embeddings, {
  scoreThreshold: 0.99,
});

// Set up the LLM with semantic cache
const model = new ChatOpenAI({
  cache,
});

// Example prompt
const response1 = await model.invoke("What is semantic caching?");
console.log(response1);

const response2 = await model.invoke("What is semantic caching?");
console.log(response2);

// Clean up
await client.close();
