import { MongoClient } from "mongodb";
import { MongoDBCache } from "@langchain/mongodb";
import { OpenAI } from "@langchain/openai";

let client;
if (process.env.MONGODB_ATLAS_URI) {
  client = new MongoClient(process.env.MONGODB_ATLAS_URI);
} else {
  client = new MongoClient("mongodb://localhost:27017");
}

await client.connect();
const collection = client.db("langchain").collection("llm_cache");

const cache = new MongoDBCache({ collection });

const model = new OpenAI({ cache });

const response1 = await model.invoke("Tell me a joke!");
console.log(response1);

const response2 = await model.invoke("Tell me a joke!");
console.log(response2);

// Hint: You can speed up fetching cached entries by setting up an index on prompt:
// await collection.createIndex({ prompt: 1 });
