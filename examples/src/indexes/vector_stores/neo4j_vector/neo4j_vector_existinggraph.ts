import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Neo4jVectorStore } from "langchain/vectorstores/neo4j_vector";

/**
 * `fromExistingGraph` Method:
 *
 * Description:
 * This method initializes a `Neo4jVectorStore` instance using an existing graph in the Neo4j database.
 * It's designed to work with nodes that already have textual properties but might not have embeddings.
 * The method will compute and store embeddings for nodes that lack them.
 *
 * Note:
 * This method is particularly useful when you have a pre-existing graph with textual data and you want
 * to enhance it with vector embeddings for similarity searches without altering the original data structure.
 */

// Configuration object for Neo4j connection and other related settings
const config = {
  url: "bolt://localhost:7687", // URL for the Neo4j instance
  username: "neo4j", // Username for Neo4j authentication
  password: "pleaseletmein", // Password for Neo4j authentication
  indexName: "wikipedia",
  nodeLabel: "Wikipedia",
  textNodeProperties: ["title", "description"],
  embeddingNodeProperty: "embedding",
  searchType: "hybrid" as const,
};

// You should have a populated Neo4j database to use this method
const neo4jVectorIndex = await Neo4jVectorStore.fromExistingGraph(
  new OpenAIEmbeddings(),
  config
);

await neo4jVectorIndex.close();
